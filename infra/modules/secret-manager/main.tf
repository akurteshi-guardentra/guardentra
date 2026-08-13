# Phase 2 starter — Secret Manager module.
# First real Terraform PR (plan §13 Week 0 step 5): provisions secret shells
# only. Actual secret *values* are set out-of-band (gcloud or console) —
# Terraform should manage the resource and IAM binding, not the secret payload,
# so credentials never land in a .tf file or state diff.

variable "project_id" {
  description = "GCP project id for this environment (e.g. the EU staging Firebase project)"
  type        = string
}

variable "region" {
  description = "GCP region for the secret replication policy"
  type        = string
}

variable "backend_service_account_email" {
  description = "The App Hosting backend's service account — the only identity granted secretAccessor"
  type        = string
}

variable "secret_names" {
  description = "Secrets this environment needs (e.g. [\"PG_CONNECTION_STRING\"])"
  type        = list(string)
  default     = ["PG_CONNECTION_STRING"]
}

resource "google_secret_manager_secret" "this" {
  for_each  = toset(var.secret_names)
  project   = var.project_id
  secret_id = each.value

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

# Least privilege: only this environment's own App Hosting backend can read
# these secrets — matches plan §5's IAM table exactly. No project-wide grant.
resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each  = google_secret_manager_secret.this
  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.backend_service_account_email}"
}

output "secret_ids" {
  value = [for s in google_secret_manager_secret.this : s.secret_id]
}
