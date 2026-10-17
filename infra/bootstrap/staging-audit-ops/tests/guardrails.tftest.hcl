# Mocked plan only. No credentials, state writes to GCS, or cloud API execution.
mock_provider "google" {}

variables {
  billing_account_id = "019203-E57CB3-666105"
}

run "review_required" {
  command         = plan
  expect_failures = [google_project.ops]
}

run "reject_other_billing_account" {
  command = plan
  variables {
    credential_isolation_review_complete = true
    billing_account_id                   = "000000-000000-000000"
  }
  expect_failures = [var.billing_account_id]
}

run "isolated_secret_metadata_only" {
  command = plan
  variables {
    credential_isolation_review_complete = true
  }
  assert {
    condition     = google_project.ops.project_id == "guardentra-staging-audit-ops" && google_project.ops.org_id == "280975227603" && !google_project.ops.auto_create_network && google_project.ops.deletion_policy == "PREVENT"
    error_message = "Only the isolated operations project may be proposed, with deletion protection."
  }
  assert {
    condition     = length(google_secret_manager_secret.credentials) == 2 && alltrue([for secret in google_secret_manager_secret.credentials : secret.project == "guardentra-staging-audit-ops" && secret.replication[0].user_managed[0].replicas[0].location == "us-central1"])
    error_message = "Only two region-pinned secret metadata resources belong in the operations project."
  }
}
