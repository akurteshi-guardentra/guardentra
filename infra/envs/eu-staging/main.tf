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
  source                        = "../../modules/secret-manager"
  project_id                    = var.project_id
  region                        = var.region
  backend_service_account_email = var.backend_service_account_email
  secret_names                  = ["PG_CONNECTION_STRING", "AUDIT_DATABASE_URL", "AUDIT_SPINE_ENABLED"]
}

# Path B — private VPC first, then Cloud SQL (both default off).
# Order: enable APIs → enable_vpc=true apply → set vpc_network_id / enable_cloud_sql=true apply.
# Never enable AUDIT_SPINE on production App Hosting from this env.
variable "enable_vpc" {
  type    = bool
  default = false
}

variable "enable_cloud_sql" {
  type    = bool
  default = false
}

variable "vpc_network_id" {
  description = "Override VPC id/self-link for Cloud SQL. Empty = use module.vpc[0] when enable_vpc."
  type        = string
  default     = ""
}

module "vpc" {
  count      = var.enable_vpc ? 1 : 0
  source     = "../../modules/vpc"
  project_id = var.project_id
  region     = var.region
}

locals {
  resolved_vpc_network_id = var.vpc_network_id != "" ? var.vpc_network_id : try(module.vpc[0].network_id, "")
}

module "cloud_sql" {
  count          = var.enable_cloud_sql ? 1 : 0
  source         = "../../modules/cloud-sql"
  project_id     = var.project_id
  region         = var.region
  vpc_network_id = local.resolved_vpc_network_id
}
