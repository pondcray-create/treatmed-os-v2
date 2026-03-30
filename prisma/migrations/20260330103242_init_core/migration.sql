-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'as_staff', 'stock', 'technician', 'se_staff');

-- CreateEnum
CREATE TYPE "ServiceJobType" AS ENUM ('repair', 'calibration', 'preventive_maintenance', 'commissioning');

-- CreateEnum
CREATE TYPE "ServiceJobSource" AS ENUM ('manual', 'se_request', 'stock_dispatch', 'proactive');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'as_staff',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEnglish" TEXT,
    "orgType" TEXT NOT NULL,
    "orgFormat" TEXT,
    "province" TEXT,
    "region" TEXT,
    "healthDistrict" INTEGER,
    "oneQa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "tel" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_service_jobs" (
    "id" TEXT NOT NULL,
    "jobNo" TEXT NOT NULL,
    "jobType" "ServiceJobType" NOT NULL,
    "status" TEXT NOT NULL,
    "source" "ServiceJobSource" NOT NULL DEFAULT 'manual',
    "sourceDispatchId" TEXT,
    "customerOrgId" TEXT,
    "customerOrgNameSnapshot" TEXT NOT NULL,
    "customerName" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "routing" TEXT,
    "rmaCode" TEXT,
    "symptom" TEXT,
    "symptomActual" TEXT,
    "fixMethod" TEXT,
    "receivedDate" TIMESTAMP(3),
    "calibrationDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "trackingIn" TEXT,
    "trackingOut" TEXT,
    "invoiceNo" TEXT,
    "warrantyDays" TEXT,
    "quoteData" JSONB,
    "partsUsed" JSONB,
    "photosBefore" JSONB,
    "photosAfter" JSONB,
    "lab" TEXT,
    "stockReturnReceivedAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_service_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_stock_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "serialNumber" TEXT,
    "minStock" INTEGER,
    "poNo" TEXT,
    "supplier" TEXT,
    "stockedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "soldToOrgId" TEXT,
    "lastCalibrationDate" TIMESTAMP(3),
    "calibrationDueDate" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_stock_transactions" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT,
    "txType" TEXT NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "note" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "as_stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_stock_bookings" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "salesName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "bookedDate" TIMESTAMP(3) NOT NULL,
    "requestStatus" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "seDealId" TEXT,
    "note" TEXT,
    "stockFeedback" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_stock_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_stock_dispatches" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT,
    "serviceJobId" TEXT,
    "dispatchType" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_stock_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_parts_requests" (
    "id" TEXT NOT NULL,
    "serviceJobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "partsData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_parts_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_proactive_calibration_assets" (
    "id" TEXT NOT NULL,
    "customerOrgId" TEXT,
    "customerOrgName" TEXT NOT NULL,
    "customerName" TEXT,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "lastCalibrationDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "retiredReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_proactive_calibration_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "se_deals" (
    "id" TEXT NOT NULL,
    "dealNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerNameEnglish" TEXT,
    "marketSegment" TEXT,
    "productModel" TEXT,
    "manufacturer" TEXT,
    "productLines" JSONB,
    "stage" TEXT NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "probability" INTEGER NOT NULL,
    "expectedCloseDate" TIMESTAMP(3) NOT NULL,
    "owner" TEXT,
    "province" TEXT,
    "region" TEXT,
    "healthDistrict" INTEGER,
    "customerSegment" TEXT,
    "nextFollowupOn" TIMESTAMP(3),
    "adminQuoteNo" TEXT,
    "onEbidding" BOOLEAN NOT NULL DEFAULT false,
    "declaredInHand" BOOLEAN NOT NULL DEFAULT false,
    "belowStageProbNote" TEXT,
    "lostReason" TEXT,
    "lostReasonNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "se_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "se_deal_activities" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "note" TEXT,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "actorName" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "se_deal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "se_service_requests" (
    "id" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "dealId" TEXT,
    "customerName" TEXT NOT NULL,
    "dealTitle" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "owner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "se_service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "se_order_requests" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "dealNo" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "dealTitle" TEXT NOT NULL,
    "customerPoNo" TEXT NOT NULL,
    "adminQuoteNo" TEXT,
    "owner" TEXT,
    "note" TEXT,
    "stockPoVerified" BOOLEAN NOT NULL DEFAULT false,
    "stockPoVerifiedAt" TIMESTAMP(3),
    "stockPoVerifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "se_order_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "appName" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_settings" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "kpiName" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "resetCycle" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_dropdown_config" (
    "id" TEXT NOT NULL DEFAULT 'as_dropdown',
    "stockModels" JSONB,
    "stockManufacturers" JSONB,
    "calibrationLabs" JSONB,
    "serviceTechnicians" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_dropdown_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "as_workflow_settings" (
    "id" TEXT NOT NULL DEFAULT 'as_workflow',
    "serviceStatuses" JSONB NOT NULL,
    "calibrationStatuses" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "as_workflow_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "se_settings" (
    "id" TEXT NOT NULL DEFAULT 'se_setting',
    "seOwners" JSONB NOT NULL,
    "seLostReasons" JSONB NOT NULL,
    "seCustomerSegments" JSONB NOT NULL,
    "sePotentialPerformanceAxes" JSONB NOT NULL,
    "sePotentialPerformanceScores" JSONB NOT NULL,
    "sePipelineStages" JSONB NOT NULL,
    "companyAchieveFactor" DECIMAL(5,4) NOT NULL,
    "segmentMixPublicHospitalPct" INTEGER NOT NULL,
    "segmentMixOtherPct" INTEGER NOT NULL,
    "segmentMixBufferPct" INTEGER NOT NULL,
    "healthDistrictTargets" JSONB NOT NULL,
    "seInHandMinProbability" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "se_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- CreateIndex
CREATE INDEX "as_organizations_province_region_healthDistrict_idx" ON "as_organizations"("province", "region", "healthDistrict");

-- CreateIndex
CREATE UNIQUE INDEX "as_organizations_name_key" ON "as_organizations"("name");

-- CreateIndex
CREATE INDEX "as_contacts_organizationId_isPrimary_idx" ON "as_contacts"("organizationId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "as_service_jobs_jobNo_key" ON "as_service_jobs"("jobNo");

-- CreateIndex
CREATE INDEX "as_service_jobs_status_jobType_idx" ON "as_service_jobs"("status", "jobType");

-- CreateIndex
CREATE INDEX "as_service_jobs_customerOrgId_createdAt_idx" ON "as_service_jobs"("customerOrgId", "createdAt");

-- CreateIndex
CREATE INDEX "as_service_jobs_serialNumber_idx" ON "as_service_jobs"("serialNumber");

-- CreateIndex
CREATE INDEX "as_stock_items_category_status_idx" ON "as_stock_items"("category", "status");

-- CreateIndex
CREATE INDEX "as_stock_items_serialNumber_idx" ON "as_stock_items"("serialNumber");

-- CreateIndex
CREATE INDEX "as_stock_transactions_stockItemId_createdAt_idx" ON "as_stock_transactions"("stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "as_stock_transactions_refType_refId_idx" ON "as_stock_transactions"("refType", "refId");

-- CreateIndex
CREATE INDEX "as_stock_bookings_requestStatus_bookedDate_idx" ON "as_stock_bookings"("requestStatus", "bookedDate");

-- CreateIndex
CREATE INDEX "as_stock_bookings_seDealId_idx" ON "as_stock_bookings"("seDealId");

-- CreateIndex
CREATE INDEX "as_stock_dispatches_status_dispatchType_idx" ON "as_stock_dispatches"("status", "dispatchType");

-- CreateIndex
CREATE INDEX "as_stock_dispatches_serviceJobId_idx" ON "as_stock_dispatches"("serviceJobId");

-- CreateIndex
CREATE INDEX "as_parts_requests_serviceJobId_status_idx" ON "as_parts_requests"("serviceJobId", "status");

-- CreateIndex
CREATE INDEX "as_proactive_calibration_assets_dueDate_retiredAt_idx" ON "as_proactive_calibration_assets"("dueDate", "retiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "as_proactive_calibration_assets_serialNumber_key" ON "as_proactive_calibration_assets"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "se_deals_dealNo_key" ON "se_deals"("dealNo");

-- CreateIndex
CREATE INDEX "se_deals_owner_stage_idx" ON "se_deals"("owner", "stage");

-- CreateIndex
CREATE INDEX "se_deals_customerName_createdAt_idx" ON "se_deals"("customerName", "createdAt");

-- CreateIndex
CREATE INDEX "se_deal_activities_dealId_occurredOn_idx" ON "se_deal_activities"("dealId", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "se_service_requests_refNo_key" ON "se_service_requests"("refNo");

-- CreateIndex
CREATE INDEX "se_service_requests_status_createdAt_idx" ON "se_service_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "se_order_requests_owner_createdAt_idx" ON "se_order_requests"("owner", "createdAt");

-- CreateIndex
CREATE INDEX "kpi_settings_module_idx" ON "kpi_settings"("module");

-- AddForeignKey
ALTER TABLE "as_contacts" ADD CONSTRAINT "as_contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "as_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_service_jobs" ADD CONSTRAINT "as_service_jobs_customerOrgId_fkey" FOREIGN KEY ("customerOrgId") REFERENCES "as_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_service_jobs" ADD CONSTRAINT "as_service_jobs_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_service_jobs" ADD CONSTRAINT "as_service_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_stock_items" ADD CONSTRAINT "as_stock_items_soldToOrgId_fkey" FOREIGN KEY ("soldToOrgId") REFERENCES "as_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_stock_transactions" ADD CONSTRAINT "as_stock_transactions_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "as_stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_stock_bookings" ADD CONSTRAINT "as_stock_bookings_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "as_stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_stock_dispatches" ADD CONSTRAINT "as_stock_dispatches_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "as_stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_stock_dispatches" ADD CONSTRAINT "as_stock_dispatches_serviceJobId_fkey" FOREIGN KEY ("serviceJobId") REFERENCES "as_service_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_parts_requests" ADD CONSTRAINT "as_parts_requests_serviceJobId_fkey" FOREIGN KEY ("serviceJobId") REFERENCES "as_service_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "as_proactive_calibration_assets" ADD CONSTRAINT "as_proactive_calibration_assets_customerOrgId_fkey" FOREIGN KEY ("customerOrgId") REFERENCES "as_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "se_deal_activities" ADD CONSTRAINT "se_deal_activities_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "se_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "se_service_requests" ADD CONSTRAINT "se_service_requests_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "se_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "se_order_requests" ADD CONSTRAINT "se_order_requests_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "se_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
