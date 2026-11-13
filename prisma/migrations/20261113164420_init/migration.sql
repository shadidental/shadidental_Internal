-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'IT_STAFF', 'HR', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('LAPTOP', 'DESKTOP', 'MONITOR', 'PHONE', 'TABLET', 'PRINTER', 'NETWORK', 'PERIPHERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('IN_STOCK', 'ASSIGNED', 'UNDER_REPAIR', 'RETIRED', 'LOST_STOLEN');

-- CreateEnum
CREATE TYPE "HrRequestType" AS ENUM ('JOINER', 'LEAVER', 'ASSET_ALLOCATION', 'ASSET_RETURN');

-- CreateEnum
CREATE TYPE "HrRequestStatus" AS ENUM ('SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "PortalUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "PortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "branchId" TEXT,
    "lineManager" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAccount" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdOn" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "disabledOn" DATE,
    "deletedOn" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" DATE,
    "vendor" TEXT,
    "purchaseCost" DECIMAL(12,2),
    "invoiceRef" TEXT,
    "warrantyExpiry" DATE,
    "branchId" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_STOCK',
    "currentOwnerId" TEXT,
    "conditionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" DATE NOT NULL,
    "assignedById" TEXT NOT NULL,
    "conditionOut" TEXT,
    "returnedAt" DATE,
    "returnedById" TEXT,
    "conditionIn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTagCounter" (
    "category" "AssetCategory" NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssetTagCounter_pkey" PRIMARY KEY ("category")
);

-- CreateTable
CREATE TABLE "HrRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "HrRequestType" NOT NULL,
    "status" "HrRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "branchName" TEXT,
    "lineManager" TEXT,
    "effectiveDate" DATE,
    "details" TEXT,
    "raisedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRequestComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestCounter" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RequestCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "kind" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "sentById" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "transport" TEXT NOT NULL,
    "messageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalUser_email_key" ON "PortalUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "EmployeeAccount_employeeId_idx" ON "EmployeeAccount"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetTag_key" ON "Asset"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serialNumber_key" ON "Asset"("serialNumber");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "Asset_category_idx" ON "Asset"("category");

-- CreateIndex
CREATE INDEX "Asset_branchId_idx" ON "Asset"("branchId");

-- CreateIndex
CREATE INDEX "Asset_warrantyExpiry_idx" ON "Asset"("warrantyExpiry");

-- CreateIndex
CREATE INDEX "AssetAssignment_assetId_idx" ON "AssetAssignment"("assetId");

-- CreateIndex
CREATE INDEX "AssetAssignment_employeeId_idx" ON "AssetAssignment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "HrRequest_reference_key" ON "HrRequest"("reference");

-- CreateIndex
CREATE INDEX "HrRequest_status_idx" ON "HrRequest"("status");

-- CreateIndex
CREATE INDEX "HrRequest_type_idx" ON "HrRequest"("type");

-- CreateIndex
CREATE INDEX "HrRequestComment_requestId_idx" ON "HrRequestComment"("requestId");

-- CreateIndex
CREATE INDEX "EmailLog_requestId_idx" ON "EmailLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAccount" ADD CONSTRAINT "EmployeeAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAccount" ADD CONSTRAINT "EmployeeAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_currentOwnerId_fkey" FOREIGN KEY ("currentOwnerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "PortalUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "PortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequest" ADD CONSTRAINT "HrRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequest" ADD CONSTRAINT "HrRequest_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "PortalUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequest" ADD CONSTRAINT "HrRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "PortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequestComment" ADD CONSTRAINT "HrRequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HrRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequestComment" ADD CONSTRAINT "HrRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "PortalUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HrRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "PortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "PortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Append-only protections ─────────────────────────────────────────────
-- Audit log entries can never be changed or removed.
CREATE OR REPLACE FUNCTION audit_log_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_changes();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_changes();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_changes();

-- Email records: content is frozen once written. Only delivery status
-- fields (status, messageId, error, sentAt) may be updated; no deletes.
CREATE OR REPLACE FUNCTION email_log_protect() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'EmailLog is append-only: DELETE is not allowed';
  END IF;
  IF NEW."fromAddress" IS DISTINCT FROM OLD."fromAddress"
     OR NEW."toAddresses" IS DISTINCT FROM OLD."toAddresses"
     OR NEW."ccAddresses" IS DISTINCT FROM OLD."ccAddresses"
     OR NEW."subject" IS DISTINCT FROM OLD."subject"
     OR NEW."bodyText" IS DISTINCT FROM OLD."bodyText"
     OR NEW."bodyHtml" IS DISTINCT FROM OLD."bodyHtml"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR NEW."requestId" IS DISTINCT FROM OLD."requestId"
     OR NEW."sentById" IS DISTINCT FROM OLD."sentById" THEN
    RAISE EXCEPTION 'EmailLog content cannot be changed once recorded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_log_protect_update BEFORE UPDATE ON "EmailLog"
  FOR EACH ROW EXECUTE FUNCTION email_log_protect();
CREATE TRIGGER email_log_protect_delete BEFORE DELETE ON "EmailLog"
  FOR EACH ROW EXECUTE FUNCTION email_log_protect();
