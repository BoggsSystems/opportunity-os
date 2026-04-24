-- AlterEnum
ALTER TYPE "WorkspaceMode" ADD VALUE 'discovery_scan';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "workspaceMode" "WorkspaceMode" NOT NULL DEFAULT 'campaign_review';

-- AlterTable
ALTER TABLE "discovery_provider_runs" ALTER COLUMN "updated_at" DROP DEFAULT;
