"""Role names, status values, allowed status transitions and permission groups.

Keeping these in one file means a business rule (for example "which roles can
see inventory") is changed in exactly one place.
"""


class Roles:
    ADMIN = "Administrator"
    MANAGER = "Manager"
    SALES = "Sales Executive"
    INVENTORY = "Inventory Executive"
    EMPLOYEE = "Employee"

    ALL = (ADMIN, MANAGER, SALES, INVENTORY, EMPLOYEE)


# --------------------------------------------------------------------------
# Status values (they match the CHECK/description column notes in the schema)
# --------------------------------------------------------------------------
class OrderStatus:
    PENDING = "Pending"
    CONFIRMED = "Confirmed"
    SHIPPED = "Shipped"
    DELIVERED = "Delivered"
    CANCELLED = "Cancelled"


class TaskStatus:
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    OVERDUE = "Overdue"  # derived from due_date, never set by hand


class TaskPriority:
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class IssueStatus:
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"
    CLOSED = "Closed"


class PRStatus:
    SUBMITTED = "Submitted"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CLOSED = "Closed"


class ApprovalStatus:
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


# --------------------------------------------------------------------------
# Allowed status transitions. Anything not listed here is rejected with 409.
# --------------------------------------------------------------------------
ORDER_TRANSITIONS = {
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
    OrderStatus.SHIPPED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}

# Employees move their own work forward; only managers may re-open it.
TASK_TRANSITIONS = {
    TaskStatus.PENDING: {TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED},
    TaskStatus.IN_PROGRESS: {TaskStatus.PENDING, TaskStatus.COMPLETED},
    TaskStatus.COMPLETED: {TaskStatus.IN_PROGRESS},
}
TASK_REOPEN_ONLY_MANAGER = {(TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS)}

ISSUE_TRANSITIONS = {
    IssueStatus.OPEN: {IssueStatus.IN_PROGRESS, IssueStatus.RESOLVED},
    IssueStatus.IN_PROGRESS: {IssueStatus.RESOLVED, IssueStatus.OPEN},
    IssueStatus.RESOLVED: {IssueStatus.CLOSED, IssueStatus.IN_PROGRESS},
    IssueStatus.CLOSED: set(),
}

# After a purchase request is approved it can only move forward.
PR_TRANSITIONS = {
    PRStatus.IN_PROGRESS: {PRStatus.COMPLETED, PRStatus.CLOSED},
    PRStatus.COMPLETED: {PRStatus.CLOSED},
}


# --------------------------------------------------------------------------
# Permission groups - mirrors the "Access" column of the API specification.
# --------------------------------------------------------------------------
class Perm:
    ADMIN_ONLY = (Roles.ADMIN,)

    EMPLOYEE_VIEW = (Roles.ADMIN, Roles.MANAGER)

    CUSTOMER_VIEW = (Roles.ADMIN, Roles.SALES)
    CUSTOMER_CREATE = (Roles.SALES,)
    CUSTOMER_UPDATE = (Roles.SALES, Roles.ADMIN)

    PRODUCT_VIEW = (Roles.ADMIN, Roles.MANAGER, Roles.SALES, Roles.INVENTORY)
    PRODUCT_ACTIVE_VIEW = (Roles.SALES, Roles.INVENTORY)
    PRODUCT_MANAGE = (Roles.ADMIN, Roles.INVENTORY)

    INVENTORY_VIEW = (Roles.ADMIN, Roles.INVENTORY, Roles.SALES)
    INVENTORY_LOW_STOCK = (Roles.ADMIN, Roles.INVENTORY)
    INVENTORY_MANAGE = (Roles.INVENTORY,)

    ORDER_VIEW = (Roles.ADMIN, Roles.MANAGER, Roles.SALES)
    ORDER_CREATE = (Roles.SALES,)
    ORDER_STATUS = (Roles.SALES, Roles.MANAGER)
    CUSTOMER_ORDERS = (Roles.SALES, Roles.MANAGER)
    AVAILABILITY = (Roles.SALES,)

    TASK_LIST = (Roles.ADMIN, Roles.MANAGER)
    TASK_MANAGE = (Roles.MANAGER,)
    TASK_OVERDUE = (Roles.MANAGER, Roles.ADMIN)

    ISSUE_LIST = (Roles.ADMIN, Roles.MANAGER)

    PR_LIST = (Roles.ADMIN, Roles.MANAGER, Roles.INVENTORY)
    PR_DECIDE = (Roles.MANAGER,)
    PR_STATUS = (Roles.MANAGER, Roles.INVENTORY)
    PR_ITEM_MANAGE = (Roles.INVENTORY,)

    # Any logged-in user who has an employee profile (tasks, issues, "my ..." lists).
    ANY_ROLE = Roles.ALL
