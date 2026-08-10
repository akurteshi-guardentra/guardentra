# Phase 2 starter — Cloud SQL module.
# Optionally wired from infra/envs/eu-staging (enable_cloud_sql = true + vpc_network_id).
# Keep default false until Week 0 WIF + private VPC exist. Review tier/flags before apply.

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "instance_name" {
  type    = string
  default = "guardentra-audit"
}

variable "vpc_network_id" {
  description = "Self-link of the VPC network for private IP — Cloud SQL must never get a public IP"
  type        = string
}

resource "google_sql_database_instance" "audit" {
  name             = var.instance_name
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_16"

  settings {
    tier              = "db-custom-2-8192" # review against real load before Week 5 sign-off
    edition           = "ENTERPRISE"
    availability_type = "REGIONAL" # zonal HA within the region

    ip_configuration {
      ipv4_enabled    = false # no public IP, ever
      private_network = var.vpc_network_id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "audit_db" {
  name     = "guardentra_audit"
  project  = var.project_id
  instance = google_sql_database_instance.audit.name
}

output "instance_connection_name" {
  value = google_sql_database_instance.audit.connection_name
}
