terraform {
  required_version = ">= 1.7.0"
  # Local bootstrap state only; no remote backend is initialized here.
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project               = "guardentra-staging"
  region                = "us-central1"
  billing_project       = "guardentra-staging"
  user_project_override = true
}

variable "state_project_id" {
  type    = string
  default = "guardentra-staging-state"
  validation {
    condition     = var.state_project_id == "guardentra-staging-state"
    error_message = "This root may create only guardentra-staging-state; never staging, production or legacy projects."
  }
}

variable "organization_id" {
  type    = string
  default = "280975227603"
  validation {
    condition     = var.organization_id == "280975227603"
    error_message = "Only the inventoried GuardEntra organization is in scope."
  }
}

variable "billing_account_id" {
  description = "Explicit metadata-verified billing account; linking requires exact-plan Owner approval."
  type        = string
  validation {
    condition     = var.billing_account_id == "019203-E57CB3-666105"
    error_message = "Only the verified staging billing account is in scope."
  }
}

variable "state_operator_member" {
  type    = string
  default = "user:admin@guardentra.com"
  validation {
    condition     = var.state_operator_member == "user:admin@guardentra.com"
    error_message = "Only the verified human operator is in scope; no runtime or other service-account grant."
  }
}

variable "state_isolation_review_complete" {
  description = "Recorded technical review of policy/name/billing/cost/custody/isolation proposal; not Owner apply approval or proof of live access denial."
  type        = bool
  default     = false
}

resource "google_project" "state" {
  project_id          = var.state_project_id
  name                = "GuardEntra Staging Terraform State"
  org_id              = var.organization_id
  billing_account     = var.billing_account_id
  auto_create_network = false
  deletion_policy     = "PREVENT"

  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.state_isolation_review_complete
      error_message = "BLOCKED: record the technical isolation review before live planning. Owner approval of the exact plan is required separately before any apply."
    }
  }
}

resource "google_project_service" "storage" {
  project            = google_project.state.project_id
  service            = "storage.googleapis.com"
  disable_on_destroy = false
}

resource "google_storage_bucket" "state" {
  project                     = google_project.state.project_id
  name                        = "guardentra-staging-state-tfstate"
  location                    = "US-CENTRAL1"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }
  soft_delete_policy {
    retention_duration_seconds = 604800
  }
  lifecycle {
    prevent_destroy = true
  }
  depends_on = [google_project_service.storage]
}

resource "google_storage_bucket_iam_member" "operator" {
  bucket = google_storage_bucket.state.name
  role   = "roles/storage.objectAdmin"
  member = var.state_operator_member
}

output "state_project_id" {
  value = google_project.state.project_id
}
output "state_bucket" {
  value = google_storage_bucket.state.name
}
output "state_prefix" {
  value = "guardentra/named-staging/audit"
}
