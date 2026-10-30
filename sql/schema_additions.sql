-- =============================================================================
-- Schema additions required by the API (SQL Server / T-SQL)
-- Run ONCE against database [B3A-S7-T2] after the 11 base tables exist.
-- Each change is guarded, so re-running the script is safe.
-- =============================================================================

-- 1. Inventory.reorder_level  -> powers GET /inventory/low-stock and the dashboards
IF COL_LENGTH('Inventory', 'reorder_level') IS NULL
BEGIN
    ALTER TABLE Inventory ADD reorder_level INT NOT NULL
        CONSTRAINT DF_Inventory_reorder DEFAULT 0;
    ALTER TABLE Inventory ADD CONSTRAINT CK_Inventory_reorder CHECK (reorder_level >= 0);
END
GO

-- 2. Soft-delete flags (users, employees and customers are deactivated, never deleted)
IF COL_LENGTH('Users', 'is_active') IS NULL
    ALTER TABLE Users ADD is_active BIT NOT NULL CONSTRAINT DF_Users_active DEFAULT 1;
IF COL_LENGTH('Employee', 'is_active') IS NULL
    ALTER TABLE Employee ADD is_active BIT NOT NULL CONSTRAINT DF_Employee_active DEFAULT 1;
IF COL_LENGTH('Customer', 'is_active') IS NULL
    ALTER TABLE Customer ADD is_active BIT NOT NULL CONSTRAINT DF_Customer_active DEFAULT 1;
GO

-- 3. Purchase_Request.rejection_reason  -> "reject and record the reason"
IF COL_LENGTH('Purchase_Request', 'rejection_reason') IS NULL
    ALTER TABLE Purchase_Request ADD rejection_reason VARCHAR(500) NULL;
GO

-- 4. Sales_Order_Item  -> which products/quantities belong to an order
IF OBJECT_ID('Sales_Order_Item', 'U') IS NULL
BEGIN
    CREATE TABLE Sales_Order_Item (
        order_item_id INT IDENTITY(1,1) PRIMARY KEY,
        order_id      INT NOT NULL
            CONSTRAINT FK_SOI_Order   FOREIGN KEY REFERENCES Sales_Order(order_id),
        product_id    INT NOT NULL
            CONSTRAINT FK_SOI_Product FOREIGN KEY REFERENCES Product(product_id),
        quantity      INT NOT NULL CONSTRAINT CK_SalesOrderItem_quantity CHECK (quantity > 0),
        unit_price    DECIMAL(12,2) NOT NULL
            CONSTRAINT CK_SalesOrderItem_price CHECK (unit_price >= 0)
    );
    CREATE INDEX IX_SOI_Order ON Sales_Order_Item(order_id);
END
GO

-- 5. Helpful indexes for the most common filters (all optional, all safe to skip)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesOrder_Status')
    CREATE INDEX IX_SalesOrder_Status ON Sales_Order(status, order_date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Task_AssignedTo')
    CREATE INDEX IX_Task_AssignedTo ON Customer_Task(assigned_to, status, due_date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PR_Approval')
    CREATE INDEX IX_PR_Approval ON Purchase_Request(approval_status);
GO

-- 6. The five fixed roles (the API compares these exact lowercase names)
INSERT INTO Role (role_name, description)
SELECT v.role_name, v.description FROM (VALUES
    ('admin',     'Manages users, roles and oversees the whole system'),
    ('manager',   'Assigns tasks, approves purchase requests, monitors operations'),
    ('sales',     'Manages customers and sales orders'),
    ('inventory', 'Manages products, stock and purchase requests'),
    ('employee',  'Views tasks, updates progress, raises issues')
) AS v(role_name, description)
WHERE NOT EXISTS (SELECT 1 FROM Role r WHERE r.role_name = v.role_name);
GO
