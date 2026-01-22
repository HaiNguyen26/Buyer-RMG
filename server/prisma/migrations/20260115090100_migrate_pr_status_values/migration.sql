-- Data migration: normalize legacy statuses to new ones
UPDATE purchase_requests
SET status = 'MANAGER_PENDING'::"PRStatus"
WHERE status IN ('DEPARTMENT_HEAD_PENDING'::"PRStatus", 'SUBMITTED'::"PRStatus");

UPDATE purchase_requests
SET status = 'MANAGER_APPROVED'::"PRStatus"
WHERE status = 'DEPARTMENT_HEAD_APPROVED'::"PRStatus";

UPDATE purchase_requests
SET status = 'MANAGER_REJECTED'::"PRStatus"
WHERE status = 'DEPARTMENT_HEAD_REJECTED'::"PRStatus";

UPDATE purchase_requests
SET status = 'MANAGER_RETURNED'::"PRStatus"
WHERE status = 'DEPARTMENT_HEAD_RETURNED'::"PRStatus";

UPDATE purchase_requests
SET status = 'BUYER_LEADER_PENDING'::"PRStatus"
WHERE status IN ('BRANCH_MANAGER_APPROVED'::"PRStatus", 'APPROVED_BY_BRANCH'::"PRStatus");




