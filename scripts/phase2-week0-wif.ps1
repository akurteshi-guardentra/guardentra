$ErrorActionPreference = "Stop"
$PROJECT_ID = "guardentra-7f582"
$PROJECT_NUMBER = "967769575761"
$REPO = "akurteshi-guardentra/guardentra"
$BUCKET = "gs://guardentra-tfstate-eu-staging"

$gcloud = @(
  "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $gcloud) { throw "gcloud not found. Install Google Cloud SDK, then re-run." }
$gsutil = Join-Path (Split-Path $gcloud) "gsutil.cmd"

Write-Host "Phase 2 Week 0 - project $PROJECT_ID ($PROJECT_NUMBER)"
Write-Host "Using $gcloud"

& $gcloud config set project $PROJECT_ID

$ErrorActionPreference = "Continue"
& $gcloud iam workload-identity-pools create "github-pool" `
  --project="$PROJECT_ID" --location="global" `
  --display-name="GitHub Actions pool" 2>&1

& $gcloud iam workload-identity-pools providers create-oidc "github-provider" `
  --project="$PROJECT_ID" --location="global" `
  --workload-identity-pool="github-pool" `
  --display-name="GitHub OIDC provider" `
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" `
  --attribute-condition="assertion.repository=='$REPO'" `
  --issuer-uri="https://token.actions.githubusercontent.com" 2>&1

& $gcloud iam service-accounts create "github-actions-ci" --project="$PROJECT_ID" 2>&1

& $gcloud iam service-accounts add-iam-policy-binding `
  "github-actions-ci@$PROJECT_ID.iam.gserviceaccount.com" `
  --project="$PROJECT_ID" `
  --role="roles/iam.workloadIdentityUser" `
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" 2>&1

& $gsutil mb -p $PROJECT_ID -l EU $BUCKET 2>&1
& $gsutil versioning set on $BUCKET 2>&1
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Next: set GitHub Actions variables (requires gh auth):"
Write-Host "  gh auth login"
Write-Host ("  gh variable set GCP_PROJECT_ID --body {0} --repo {1}" -f $PROJECT_ID, $REPO)
Write-Host ("  gh variable set GCP_PROJECT_NUMBER --body {0} --repo {1}" -f $PROJECT_NUMBER, $REPO)

$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  $ErrorActionPreference = "Continue"
  & gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "gh is authenticated - setting Actions variables..."
    & gh variable set GCP_PROJECT_ID --body $PROJECT_ID --repo $REPO
    & gh variable set GCP_PROJECT_NUMBER --body $PROJECT_NUMBER --repo $REPO
    Write-Host "GitHub Actions vars set."
  } else {
    Write-Host "gh not authenticated yet; skip variable set."
  }
  $ErrorActionPreference = "Stop"
}

Write-Host "Done Week 0 cloud bootstrap (re-run is safe if resources already exist)."
