'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';

export default function WorkflowDetail({ params }: { params: Promise<{ id: string }> }) {
  const [data, setData] = useState<any>(null);
  
  // React 19 unwrapping requirement for params
  const { id } = use(params);

  useEffect(() => {
    // In actual implementation, we GET /api/workflows/:id and /api/workflows/:id/audit
    setData({
      id: id,
      patient: 'John Doe',
      status: 'waiting_approval',
      type: 'pre_visit_intake',
      tasks: [
        { id: 't_1', agent: 'OrchestratorAgent', action: 'plan_workflow', status: 'completed' },
        { id: 't_2', agent: 'IntakeAgent', action: 'check_intake_completeness', status: 'completed' },
        { id: 't_3', agent: 'InsuranceAgent', action: 'check_eligibility', status: 'completed' },
        { id: 't_4', agent: 'SchedulingAgent', action: 'mark_provisional', status: 'completed' },
      ],
      audit: [
        { timestamp: '10:00:01 AM', agent: 'System_Ingress', action: 'Ingested Event: appointment_booked' },
        { timestamp: '10:00:05 AM', agent: 'OrchestratorAgent', action: 'Gemini generated task plan' },
        { timestamp: '10:00:12 AM', agent: 'IntakeAgent', action: 'Document check finished. Complete: true' },
        { timestamp: '10:00:24 AM', agent: 'InsuranceAgent', action: 'Prior auth requested automatically' },
        { timestamp: '10:00:26 AM', agent: 'SchedulingAgent', action: 'Slot successfully marked provisional.' },
        { timestamp: '10:00:28 AM', agent: 'System_StateMachine', action: 'State Transition. to: waiting_approval. Reason: Pre-Auth Risk' }
      ]
    });
  }, [id]);

  if (!data) return <div className="p-10 animate-pulse text-slate-400">Loading...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header breadcrumb */}
      <nav className="text-sm text-slate-500 font-medium flex items-center space-x-2">
        <Link href="/workflows" className="hover:text-slate-900 transition-colors">Workflows</Link>
        <span>/</span>
        <span className="text-slate-800">{id}</span>
      </nav>

      {/* Main Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{data.patient}</h2>
          <div className="flex items-center space-x-4 mt-2">
            <span className="text-slate-500 text-sm">{data.type}</span>
            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
              {data.status}
            </span>
          </div>
        </div>
        
        {/* If pending approval, quick action button */}
        {data.status === 'waiting_approval' && (
          <Link href="/approvals" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-lg shadow-sm transition-colors text-sm">
            Review Approval Request
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Dependency Graph Graph / Task List */}
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-4 tracking-tight">Active Task Graph</h3>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 space-y-1">
            {data.tasks.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                <div className="flex items-center space-x-4">
                  
                  {/* Status Indicator Bubble */}
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    t.status === 'completed' ? 'bg-emerald-500' :
                    t.status === 'failed' ? 'bg-red-500' :
                    'bg-amber-400 animate-pulse'
                  }`} />
                  
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.agent.replace('Agent', '')} Worker</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{t.action}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-300 font-mono">{t.id}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log Streaming */}
        <div>
           <h3 className="text-lg font-semibold text-slate-800 mb-4 tracking-tight">Real-time Audit Trail</h3>
           <div className="bg-slate-900 rounded-2xl shadow-sm p-6 overflow-y-auto max-h-[500px]">
             <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-800">
               {data.audit.map((log: any, idx: number) => (
                 <div key={idx} className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group">
                   
                   {/* Node Dot */}
                   <div className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-700 ring-4 ring-slate-900 absolute left-0 md:left-1/2 -translate-x-1/2 mt-1.5 z-10" />

                   {/* Log Card */}
                   <div className="bg-slate-800 rounded-lg p-4 ml-8 md:ml-0 md:w-[calc(50%-20px)] shadow-sm">
                     <div className="flex flex-col space-y-1">
                       <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{log.timestamp} • {log.agent.replace('Agent', '')}</span>
                       <span className="text-sm text-slate-300 font-medium leading-relaxed">{log.action}</span>
                     </div>
                   </div>

                 </div>
               ))}
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
