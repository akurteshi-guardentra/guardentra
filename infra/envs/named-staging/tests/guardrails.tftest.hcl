# Plan-only security regressions; mocked provider, no cloud credentials or backend.
mock_provider "google" {}

variables {
  private_service_range_cidr = "10.20.0.0/16"
}

run "reject_production_project" {
  command = plan
  variables {
    project_id = "guardentra-prod"
  }
  expect_failures = [var.project_id]
}

run "reject_other_region" {
  command = plan
  variables {
    region = "europe-west1"
  }
  expect_failures = [var.region]
}

run "reject_other_runtime" {
  command = plan
  variables {
    runtime_service_account_email = "other@guardentra-staging.iam.gserviceaccount.com"
  }
  expect_failures = [var.runtime_service_account_email]
}

run "reject_invalid_range" {
  command = plan
  variables {
    private_service_range_cidr = "REPLACE_AFTER_ROUTE_INVENTORY"
  }
  expect_failures = [var.private_service_range_cidr]
}

run "encrypted_private_database_with_api_protection" {
  command = plan
  assert {
    condition     = !google_sql_database_instance.audit.settings[0].ip_configuration[0].ipv4_enabled && google_sql_database_instance.audit.settings[0].ip_configuration[0].ssl_mode == "ENCRYPTED_ONLY"
    error_message = "Database must remain private and reject unencrypted direct connections."
  }
  assert {
    condition     = google_sql_database_instance.audit.deletion_protection && google_sql_database_instance.audit.settings[0].deletion_protection_enabled
    error_message = "Both Terraform and Cloud SQL API deletion protection must be enabled."
  }
  assert {
    condition     = google_sql_database_instance.audit.settings[0].backup_configuration[0].enabled && google_sql_database_instance.audit.settings[0].backup_configuration[0].point_in_time_recovery_enabled
    error_message = "Backups and point-in-time recovery must remain enabled."
  }
}
