terraform {
  backend "gcs" {}

  required_version = ">= 1.6.0"

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

locals {
  required_services = toset([
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each = local.required_services

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

data "google_compute_network" "default" {
  project = var.project_id
  name    = "default"

  depends_on = [google_project_service.required["compute.googleapis.com"]]
}

resource "google_compute_global_address" "audit_private_services" {
  project       = var.project_id
  name          = "guardentra-staging-audit-psa"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  address       = cidrhost(var.private_service_range_cidr, 0)
  prefix_length = tonumber(split("/", var.private_service_range_cidr)[1])
  network       = data.google_compute_network.default.id

  depends_on = [google_project_service.required["servicenetworking.googleapis.com"]]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_networking_connection" "audit_private_vpc" {
  network                 = data.google_compute_network.default.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.audit_private_services.name]

  depends_on = [google_project_service.required["servicenetworking.googleapis.com"]]
}

resource "google_sql_database_instance" "audit" {
  project          = var.project_id
  name             = var.instance_name
  region           = var.region
  database_version = var.database_version

  settings {
    tier                        = var.tier
    edition                     = "ENTERPRISE"
    availability_type           = var.availability_type
    disk_type                   = "PD_SSD"
    disk_size                   = var.disk_size_gb
    disk_autoresize             = true
    deletion_protection_enabled = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = data.google_compute_network.default.id
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = var.transaction_log_retention_days

      backup_retention_settings {
        retained_backups = var.retained_backups
        retention_unit   = "COUNT"
      }
    }
  }

  deletion_protection = true

  depends_on = [
    google_project_service.required["sqladmin.googleapis.com"],
    google_service_networking_connection.audit_private_vpc,
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_sql_database" "audit" {
  project  = var.project_id
  name     = var.database_name
  instance = google_sql_database_instance.audit.name

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "runtime_cloud_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${var.runtime_service_account_email}"
}
