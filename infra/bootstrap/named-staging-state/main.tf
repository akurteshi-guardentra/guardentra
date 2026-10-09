terraform {
  required_version = ">= 1.6.0"
  # Deliberately local bootstrap state: do not initialize the legacy GCS backend.
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
}

variable "project_id" {
  type    = string
  default = "guardentra-staging"
  validation {
    condition     = var.project_id == "guardentra-staging"
    error_message = "State bootstrap may target only guardentra-staging."
  }
}

variable "state_operator_member" {
  description = "Owner-verified Google principal for Terraform state objects; no runtime principal."
  type        = string
  validation {
    condition = can(regex("^(user|serviceAccount):[^[:space:]]+@[^[:space:]]+$", var.state_operator_member)) && (
      var.state_operator_member != "serviceAccount:firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com"
    )
    error_message = "Supply a verified user or Terraform service account, never the application runtime identity."
  }
}

variable "state_isolation_design_approved" {
  description = "Owner approval of a reviewed state-access isolation design; not proof of live effective permissions."
  type        = bool
  default     = false
}

resource "google_storage_bucket" "state" {
  project                     = var.project_id
  name                        = "guardentra-staging-tfstate-965959469996"
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

    precondition {
      condition     = var.state_isolation_design_approved
      error_message = "BLOCKED: staging runtime has inherited Storage access. Approve a reviewed isolation correction before planning/applying this bucket. Do not set this flag to bypass the review."
    }
  }
}

resource "google_storage_bucket_iam_member" "operator" {
  bucket = google_storage_bucket.state.name
  role   = "roles/storage.objectAdmin"
  member = var.state_operator_member
}

output "state_bucket" {
  value = google_storage_bucket.state.name
}

output "state_prefix" {
  value = "guardentra/named-staging/audit"
}
