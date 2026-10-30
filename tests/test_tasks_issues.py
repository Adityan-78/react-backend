"""Task assignment / progress and operational issues."""
from datetime import date, timedelta

API = "/api/v1"


def _task(client, auth, assignee, **extra):
    body = {"assigned_to": assignee, "title": "Count the stock", "priority": "High"} | extra
    return client.post(f"{API}/tasks", headers=auth("manager"), json=body)


def test_manager_creates_task_and_employee_sees_it(client, auth, employee_id):
    emp = employee_id("employee")
    r = _task(client, auth, emp, due_date=str(date.today() + timedelta(days=3)))
    assert r.status_code == 201
    task = r.json()
    assert task["status"] == "Pending" and task["assigned_by_name"] == "Test manager"
    assert task["assigned_to_name"] == "Test employee" and task["is_overdue"] is False

    mine = client.get(f"{API}/tasks/my", headers=auth("employee")).json()
    assert [t["task_id"] for t in mine["items"]] == [task["task_id"]]
    # someone else's task list stays empty
    assert client.get(f"{API}/tasks/my", headers=auth("sales")).json()["total"] == 0


def test_only_managers_create_and_validation(client, auth, employee_id):
    emp = employee_id("employee")
    assert client.post(f"{API}/tasks", headers=auth("employee"),
                       json={"assigned_to": emp, "title": "x"}).status_code == 403
    assert _task(client, auth, 999).status_code == 400
    past = _task(client, auth, emp, due_date=str(date.today() - timedelta(days=1)))
    assert past.status_code == 400
    assert _task(client, auth, emp, priority="Urgent").status_code == 422


def test_task_visibility_is_limited_to_assignee_and_staff(client, auth, employee_id):
    task = _task(client, auth, employee_id("employee")).json()
    url = f"{API}/tasks/{task['task_id']}"
    assert client.get(url, headers=auth("employee")).status_code == 200
    assert client.get(url, headers=auth("manager")).status_code == 200
    assert client.get(url, headers=auth("admin")).status_code == 200
    assert client.get(url, headers=auth("sales")).status_code == 403   # not theirs


def test_status_updates_and_transition_rules(client, auth, employee_id):
    task = _task(client, auth, employee_id("employee")).json()
    url = f"{API}/tasks/{task['task_id']}/status"

    assert client.put(url, headers=auth("employee"), json={"status": "In Progress"}).json()["status"] == "In Progress"
    assert client.put(url, headers=auth("employee"), json={"status": "Completed"}).status_code == 200
    # employees cannot re-open; the manager can
    assert client.put(url, headers=auth("employee"), json={"status": "In Progress"}).status_code == 403
    assert client.put(url, headers=auth("manager"), json={"status": "In Progress"}).status_code == 200
    # a stranger can't touch it, and "Overdue" can't be set by hand
    assert client.put(url, headers=auth("sales"), json={"status": "Completed"}).status_code == 403
    assert client.put(url, headers=auth("manager"), json={"status": "Overdue"}).status_code == 422


def test_overdue_tasks_are_detected_from_the_date(client, auth, employee_id, session_factory):
    from app.models import CustomerTask

    emp = employee_id("employee")
    mgr = employee_id("manager")
    with session_factory() as db:
        db.add(CustomerTask(assigned_to=emp, assigned_by=mgr, title="Late one",
                            due_date=date.today() - timedelta(days=2)))
        db.add(CustomerTask(assigned_to=emp, assigned_by=mgr, title="Late but done", status="Completed",
                            due_date=date.today() - timedelta(days=2)))
        db.add(CustomerTask(assigned_to=emp, assigned_by=mgr, title="Future",
                            due_date=date.today() + timedelta(days=2)))
        db.commit()

    overdue = client.get(f"{API}/tasks/overdue", headers=auth("manager")).json()
    assert [t["title"] for t in overdue["items"]] == ["Late one"]
    assert overdue["items"][0]["is_overdue"] is True
    # filtering by status=Overdue gives the same answer
    by_status = client.get(f"{API}/tasks", headers=auth("manager"), params={"status": "Overdue"}).json()
    assert by_status["total"] == 1
    # the employee-specific list
    assert client.get(f"{API}/employees/{emp}/tasks", headers=auth("manager")).json()["total"] == 3


def test_update_task_details_and_reassign(client, auth, employee_id):
    task = _task(client, auth, employee_id("employee")).json()
    r = client.put(f"{API}/tasks/{task['task_id']}", headers=auth("manager"),
                   json={"title": "New title", "assigned_to": employee_id("sales"), "priority": "Low"})
    assert r.status_code == 200
    assert r.json()["title"] == "New title" and r.json()["assigned_to_name"] == "Test sales"


# --------------------------------------------------------------------------- issues
def test_issue_lifecycle(client, auth):
    r = client.post(f"{API}/issues", headers=auth("employee"),
                    json={"title": "Forklift broken", "description": "Bay 3"})
    assert r.status_code == 201
    issue = r.json()
    assert issue["status"] == "Open" and issue["raised_by_name"] == "Test employee"

    url = f"{API}/issues/{issue['issue_id']}"
    # the reporter can read it; an unrelated user cannot
    assert client.get(url, headers=auth("employee")).status_code == 200
    assert client.get(url, headers=auth("sales")).status_code == 403
    assert client.get(f"{API}/issues/my", headers=auth("employee")).json()["total"] == 1

    # managers drive the status; reporters can't
    assert client.put(f"{url}/status", headers=auth("employee"), json={"status": "Resolved"}).status_code == 403
    assert client.put(f"{url}/status", headers=auth("manager"), json={"status": "Closed"}).status_code == 409
    assert client.put(f"{url}/status", headers=auth("manager"), json={"status": "In Progress"}).status_code == 200
    assert client.put(f"{url}/status", headers=auth("manager"), json={"status": "Resolved"}).status_code == 200
    assert client.put(f"{url}/status", headers=auth("manager"), json={"status": "Closed"}).status_code == 200
    assert client.put(f"{url}/status", headers=auth("manager"), json={"status": "Open"}).status_code == 409

    assert client.put(url, headers=auth("manager"), json={"title": "Forklift fixed"}).json()["title"] == "Forklift fixed"
    assert client.get(f"{API}/issues", headers=auth("manager"), params={"status": "Closed"}).json()["total"] == 1
