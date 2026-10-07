    const normalizedRemediationDueAt = requiresPlan
      ? normalizeRemediationDueAt(remediationDueDate)
      : null;
    if (requiresPlan && !remediationOwner.trim()) {
      setToast({ tone: 'warn', text: 'Assign a remediation owner before continuing.' });
      return;
    }
    if (requiresPlan && !normalizedRemediationDueAt) {
      setToast({ tone: 'warn', text: 'Set a valid remediation due date before continuing.' });
      return;
    }

    setApproving(true);
    const decidedBy = profile?.email || profile?.displayName || 'org-admin';
    const preferLocal = mode === 'local' || reviewAssessment.id.startsWith('local_');
    const patch = buildOrgDecisionPatch({
      outcome,
      decidedBy,
      decisionNotes: decisionNotes.trim() || undefined,
      remediationOwner: requiresPlan ? remediationOwner.trim() : undefined,
      remediationDueAt: normalizedRemediationDueAt || undefined,
      residualRiskLevel,
    });
    const closes = decisionClosesPortal(outcome);
    const nextReviewAt = nextReviewAtForDecision(outcome);

    try {
      if (preferLocal) {
        upsertLocalAssessment(orgId, { ...reviewAssessment, ...patch });
        refreshLocal();
      } else {
        const res = await fetch('/api/org/assessment-decision', {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            assessmentId: reviewAssessment.id,
            outcome,
            decisionNotes: decisionNotes.trim() || undefined,
            remediationOwner: requiresPlan ? remediationOwner.trim() : undefined,
            remediationDueAt: normalizedRemediationDueAt || undefined,
            residualRiskLevel,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || 'Could not record decision.');
        }
      }

      if (closes) {
        await syncVendorAfterAssessmentApprove(
          orgId,
          reviewAssessment.vendorId,
          preferLocal,
          nextReviewAt
        );
      }

      const exceptions = listAssessmentExceptions({
        questions: (reviewAssessment.questions || []) as any,
        answers: reviewAssessment.answers,
        evidenceByQuestion: reviewAssessment.evidenceByQuestion as any,
        evidenceTrustByStoragePath: reviewAssessment.evidenceTrustByStoragePath,
      });
      if (exceptions.length) {
        void emitAuditBestEffort({
          tenantId: orgId,
          eventType: 'exception.reviewed',
          actorId: user?.uid || null,
          objectType: 'assessment',
          objectId: reviewAssessment.id,
          payload: {
            outcome,
            exceptionIds: exceptions.slice(0, 40).map((e) => e.id),
            reasons: exceptions.slice(0, 40).map((e) => e.reason),
          },
        });
      }

      const messages: Record<DecisionOutcome, string> = {
        approved: 'Approved. Next review scheduled in 12 months.',
        conditional: 'Conditionally approved. Next review in 6 months.',
        remediate: 'Remediation recorded. Assessment stays open for follow-up.',
        rejected: 'Rejected. Portal closed and vendor assessment marked complete.',
      };
      setToast({ tone: 'ok', text: messages[outcome] });
      setIsReviewing(false);
      setReviewAssessment(null);
    } catch (e) {
      console.error('Decision failed:', e);
      setToast({ tone: 'err', text: 'Decision failed — try again.' });
    } finally {