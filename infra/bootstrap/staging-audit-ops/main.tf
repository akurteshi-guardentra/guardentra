# Candidate only: secret metadata, never credential values or secret versions.
terraform {
  required_version = ">= 1.7.0"
  backend "gcs" {}
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

variable "billing_account_id" {
  type = string
  validation {
    condition     = var.billing_account_id == "019203-E57CB3-666105"
    error_message = "Only the verified staging billing account is in scope."
  }
}

variable "credential_isolation_review_complete" {
  type        = bool
  default     = false
  description = "Recorded metadata/name/cost/residency/custody review, not apply approval."
}

resource "google_project" "ops" {
  project_id          = "guardentra-staging-audit-ops"
  name                = "GuardEntra Staging Audit Ops"
  org_id              = "280975227603"
  billing_account     = var.billing_account_id
  auto_create_network = false
  deletion_policy     = "PREVENT"
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.credential_isolation_review_complete
      error_message = "Review the credential-isolation proposal before planning; exact-plan apply approval is separate."
    }
  }
}

resource "google_project_service" "secrets" {
  project            = google_project.ops.project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_secret_manager_secret" "credentials" {
  for_each  = toset(["AUDIT_BOOTSTRAP_ADMIN_PASSWORD_74", "AUDIT_MIGRATOR_PASSWORD_74"])
  project   = google_project.ops.project_id
  secret_id = each.value
  replication {
    user_managed {
      replicas {
        location = "us-central1"
      }
    }
  }
  lifecycle {
    prevent_destroy = true
  }
  depends_on = [google_project_service.secrets]
}

output "credential_project_id" {
  value = google_project.ops.project_id
}
output "secret_names" {
  value = sort(keys(google_secret_manager_secret.credentials))
}
