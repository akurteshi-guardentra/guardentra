# NexusGRC Test Plan & Strategy (ISTQB Compliant)

## 1. Introduction
This document outlines the testing strategy for NexusGRC, ensuring a high-quality, secure, and reliable AI-driven GRC platform.

## 2. Test Objectives
- Verify all core GRC modules (Risks, Compliance, Incidents, Policies, Vendors, Audit) function as specified.
- Ensure data integrity and tenant isolation in Firestore.
- Validate AI consistency and reliability (Gemini integration).
- Provide a robust regression suite for future feature expansions.

## 3. Test Levels (ISTQB Approach)

### 3.1 Component Testing (Unit)
- **Scope**: Individual React components and helper functions.
- **Tools**: Vitest + React Testing Library.
- **Focus**: UI state, formatting, logic.

### 3.2 Integration Testing
- **Scope**: Interaction between frontend and Firestore / AI Services.
- **Focus**: Security rules, data flow, API response handling.

### 3.3 System Testing (E2E)
- **Scope**: Complete user journeys (e.g., "Add Risk -> Generate Mitigation -> Verify Compliance").
- **Tools**: Playwright.
- **Focus**: Functional flows, UI responsiveness.

### 3.4 Acceptance Testing (UAT)
- **Focus**: Suitability for CISO/Analyst personas.

## 4. Test Types

### 4.1 Functional Testing
- Core CRUD operations on all collections.
- AI Generation triggers and result displays.

### 4.2 Regression Testing
- **Critical Path**: Every code change must trigger the automated suite to ensure existing features (like the D3 Risk Matrix) don't break.

### 4.3 Security Testing
- **Tenant Isolation**: Verify a user cannot see data from another `organizationId`.
- **RBAC**: Verify 'viewer' roles cannot delete resources.

## 5. Automated Test Suite (Priority 1)

| ID | Test Case | Target Output | Type |
|----|-----------|---------------|------|
| TC-01 | Login & Auth Flow | Successful entry to Dashboard | Functional |
| TC-02 | Risk Creation | Risk appears in D3 Heatmap | Functional |
| TC-03 | AI Policy Gen | Markdown content generated and saved | AI/Regression |
| TC-04 | Audit Readiness Scan | AI returns valid Readiness Score | AI/System |
| TC-05 | RBAC Enforcement | Permission Denied on unauthorized deletes | Security |

## 6. Regression Strategy
- Automate TC-01 to TC-05 into the CI/CD pipeline.
- Implement a **System Health Monitor** inside the app for "on-demand" regression checks.
