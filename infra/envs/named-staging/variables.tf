variable "project_id" {
  description = "Named staging GCP/Firebase project. Any other project is forbidden."
  type        = string
  default     = "guardentra-staging"

  validation {
    condition     = var.project_id == "guardentra-staging"
    error_message = "This root may target only guardentra-staging."
  }
}

variable "region" {
  description = "Named staging region aligned to App Hosting and scanner."
  type        = string
  default     = "us-central1"

  validation {
    condition     = var.region == "us-central1"
    error_message = "Region is intentionally pinned to us-central1 for the reviewed staging topology."
  }
}

variable "runtime_service_account_email" {
  description = "Observed guardentra-staging App Hosting runtime service account."
  type        = string
  default     = "firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com"

  validation {
    condition     = var.runtime_service_account_email == "firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com"
    error_message = "Runtime identity must match the reviewed guardentra-staging App Hosting service account."
  }
}

variable "private_service_range_cidr" {
  description = "Collision-checked CIDR reserved for Private Service Access on the existing default VPC."
  type        = string

  validation {
    condition     = can(cidrhost(var.private_service_range_cidr, 0))
    error_message = "Provide a valid collision-checked CIDR after read-only route/range inventory."
  }
}

variable "instance_name" {
  type    = string
  default = "guardentra-staging-audit"
}

variable "database_name" {
  type    = string
  default = "guardentra_audit"
}

variable "database_version" {
  type    = string
  default = "POSTGRES_16"
}

variable "tier" {
  description = "Reviewed candidate: 2 vCPU / 8 GiB Enterprise."
  type        = string
  default     = "db-custom-2-8192"
}

variable "availability_type" {
  description = "Regional HA candidate for release acceptance."
  type        = string
  default     = "REGIONAL"

  validation {
    condition     = contains(["REGIONAL", "ZONAL"], var.availability_type)
    error_message = "availability_type must be REGIONAL or ZONAL."
  }
}

variable "disk_size_gb" {
  description = "Initial SSD capacity; autoresize remains enabled."
  type        = number
  default     = 20

  validation {
    condition     = var.disk_size_gb >= 10
    error_message = "Cloud SQL disk_size_gb must be at least 10."
  }
}

variable "retained_backups" {
  type    = number
  default = 7
}

variable "transaction_log_retention_days" {
  type    = number
  default = 7
}
