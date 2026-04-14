'use client';
import { useEffect, useState } from 'react';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([]);

  useEffect(() => {
    // Mocking the pending approvals for layout checking
    setApprovals([
      {
        id: 'app_9821',
        action: 'Reschedule Appointment',
        reason: 'Insurance Pre-Auth flagged high delay risk.',
        details: 'Initial slot was 11-04-2026. Suggesting provisional hold.',
        agent: 'SchedulingAgent',
        workflowId: 'wf_101',
        patient: 'John Doe'
      }
    ]);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Human Approval Gates</h2>
        <p className="text-slate-500 mt-2 text-sm">Tasks stalled by Agent policy requiring explicit human authorization.</p>
      </div>

      <div className="grid gap-6">
        {approvals.map(app => (
          <div key={app.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-start md:items-center">
            
            {/* Meta */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-3">
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Requires Action</span>
                <span className="text-slate-400 text-sm font-mono">{app.id}</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-800">{app.action}</h3>
              <p className="text-slate-600 text-sm leading-relaxed"><span className="font-semibold text-slate-700">Reason:</span> {app.reason}</p>
              <p className="text-slate-500 text-sm"><span className="font-semibold text-slate-700">Context:</span> {app.details}</p>
              
              <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-slate-50 text-xs text-slate-400">
                <span>Requested by <strong className="text-slate-600">{app.agent}</strong></span>
                <span>Workflow: <strong className="font-mono text-slate-600">{app.workflowId}</strong></span>
                <span>Patient: <strong className="text-slate-600">{app.patient}</strong></span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col space-y-3 w-full md:w-48 shrink-0">
              <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm shadow-emerald-200 transition-all active:scale-95">
                Approve
              </button>
              <button className="w-full bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 font-medium py-3 px-4 rounded-xl transition-all active:scale-95">
                Reject
              </button>
            </div>

          </div>
        ))}

        {approvals.length === 0 && (
          <div className="text-center py-24 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-500">No pending approvals. The system is operating autonomously.</p>
          </div>
        )}
      </div>
    </div>
  );
}
