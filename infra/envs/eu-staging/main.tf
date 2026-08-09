# Phase 2 starter — EU staging environment root module.
# Deliberately provisions ONLY Secret Manager for now (plan §13 Week 0 step 5).
# Cloud SQL is added here in Week 2, not before — the point of this first PR
# is proving the plan/apply pipeline works, not standing up the full stack.

terraform {
  backend "gcs" {
    bucket = "guardentra-tfstate-eu-staging"
    prefix = "terraform/state"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "The EU staging Firebase/GCP project id"
  type        = string
}

variable "region" {
  default = "europe-west3"
}

variable "backend_service_account_email" {
  description = "EU staging App Hosting backend's service account email"
  type        = string
}

module "secrets" {
  source                         = "../../modules/secret-manager"
  project_id                     = var.project_id
  region                         = var.region
  backend_service_account_email  = var.backend_service_account_email
  secret_names                   = ["PG_CONNECTION_STRING"]
}
