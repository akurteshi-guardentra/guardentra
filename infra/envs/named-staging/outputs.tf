output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "network_self_link" {
  value = data.google_compute_network.default.self_link
}

output "private_service_range_name" {
  value = google_compute_global_address.audit_private_services.name
}

output "cloud_sql_instance_name" {
  value = google_sql_database_instance.audit.name
}

output "cloud_sql_connection_name" {
  value = google_sql_database_instance.audit.connection_name
}

output "cloud_sql_private_ip" {
  value = google_sql_database_instance.audit.private_ip_address
}

output "database_name" {
  value = google_sql_database.audit.name
}

output "runtime_service_account_email" {
  value = var.runtime_service_account_email
}
