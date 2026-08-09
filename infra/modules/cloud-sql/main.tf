# Phase 2 starter — Cloud SQL module. NOT wired up yet in envs/eu-staging —
# add this to the environment root module in Week 2 (plan §13), after the
# Secret Manager PR (Week 0 step 5) has proven the pipeline. Reference/starting
# point only — review instance sizing and flags before applying to anything
# real.

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
    tier = "db-custom-2-8192" # review against real load before Week 5 sign-off

    ip_configuration {
      ipv4_enabled    = false # no public IP, ever
      private_network = var.vpc_network_id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
    }

    availability_type = "REGIONAL" # zonal HA within the region
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
