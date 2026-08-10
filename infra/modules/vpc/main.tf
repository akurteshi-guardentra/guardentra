# Phase 2 — private VPC stub for Cloud SQL Path B (EU staging).
# Wire from infra/envs/eu-staging with enable_vpc = true BEFORE enable_cloud_sql.
# Do not apply until Compute + Service Networking APIs are enabled on the project.

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "network_name" {
  type    = string
  default = "guardentra-eu-staging"
}

variable "subnet_cidr" {
  description = "Regional subnet CIDR (no public Cloud SQL; private services use allocated range)"
  type        = string
  default     = "10.10.0.0/24"
}

variable "private_services_cidr" {
  description = "Allocated range for Private Service Access (Cloud SQL)"
  type        = string
  default     = "10.20.0.0/16"
}

resource "google_compute_network" "this" {
  name                    = var.network_name
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "this" {
  name          = "${var.network_name}-${var.region}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.this.id
  ip_cidr_range = var.subnet_cidr

  private_ip_google_access = true
}

resource "google_compute_global_address" "private_services" {
  name          = "${var.network_name}-psa"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = tonumber(split("/", var.private_services_cidr)[1])
  address       = split("/", var.private_services_cidr)[0]
  network       = google_compute_network.this.id
}

resource "google_service_networking_connection" "private_vpc" {
  network                 = google_compute_network.this.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

output "network_id" {
  value = google_compute_network.this.id
}

output "network_self_link" {
  value = google_compute_network.this.self_link
}

output "subnet_id" {
  value = google_compute_subnetwork.this.id
}
