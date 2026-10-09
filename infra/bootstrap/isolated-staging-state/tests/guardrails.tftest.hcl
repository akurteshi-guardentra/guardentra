# All runs use a mocked Google provider and plan only; no credentials/cloud calls.
mock_provider "google" {}

variables {
  billing_account_id = "019203-E57CB3-666105"
}

run "review_required" {
  command         = plan
  expect_failures = [google_project.state]
}

run "reject_production_project" {
  command = plan
  variables {
    state_isolation_review_complete = true
    state_project_id                = "guardentra-prod"
  }
  expect_failures = [var.state_project_id]
}

run "reject_other_organization" {
  command = plan
  variables {
    state_isolation_review_complete = true
    organization_id                 = "999999999999"
  }
  expect_failures = [var.organization_id]
}

run "reject_other_billing_account" {
  command = plan
  variables {
    state_isolation_review_complete = true
    billing_account_id              = "000000-000000-000000"
  }
  expect_failures = [var.billing_account_id]
}

run "reject_runtime_operator" {
  command = plan
  variables {
    state_isolation_review_complete = true
    state_operator_member           = "serviceAccount:firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com"
  }
  expect_failures = [var.state_operator_member]
}

run "reviewed_mock_proposal" {
  command = plan
  variables {
    state_isolation_review_complete = true
  }
  assert {
    condition     = google_storage_bucket.state.project == "guardentra-staging-state" && google_storage_bucket_iam_member.operator.member == "user:admin@guardentra.com"
    error_message = "State must be in its separate project with only the intended human operator binding."
  }
  assert {
    condition     = google_storage_bucket.state.uniform_bucket_level_access && google_storage_bucket.state.public_access_prevention == "enforced" && !google_storage_bucket.state.force_destroy && google_storage_bucket.state.versioning[0].enabled && google_storage_bucket.state.soft_delete_policy[0].retention_duration_seconds == 604800
    error_message = "Bucket privacy/recovery protections changed."
  }
  assert {
    condition     = google_project.state.deletion_policy == "PREVENT" && !google_project.state.auto_create_network
    error_message = "Project must retain deletion protection and remove the default network."
  }
}
