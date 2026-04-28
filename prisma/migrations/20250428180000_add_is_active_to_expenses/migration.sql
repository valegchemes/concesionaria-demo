-- Add isActive column to CompanyExpense for soft delete support

-- AlterTable
ALTER TABLE "CompanyExpense" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS "CompanyExpense_companyId_isActive_idx" ON "CompanyExpense"("companyId", "isActive");
