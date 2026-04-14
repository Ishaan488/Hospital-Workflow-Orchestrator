'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);

  useEffect(() => {
    // Mocked subset matching dashboard
    setWorkflows([
      { id: 'wf_101', type: 'pre_visit_intake', status: 'waiting_approval', patient: 'John Doe', updated: '2 mins ago' },
      { id: 'wf_102', type: 'pre_visit_intake', status: 'in_progress', patient: 'Jane Smith', updated: '15 mins ago' },
      { id: 'wf_103', type: 'pre_visit_intake', status: 'completed', patient: 'Bob Wilson', updated: '1 hr ago' },
      { id: 'wf_104', type: 'pre_visit_intake', status: 'completed', patient: 'Alice Johnson', updated: 'Yesterday' },
      { id: 'wf_105', type: 'pre_visit_intake', status: 'failed', patient: 'Sam Carter', updated: 'Yesterday' },
    ]);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">All Workflows</h2>
          <p className="text-slate-500 mt-2 text-sm">Every orchestrated pipeline run.</p>
        </div>
        
        {/* Placeholder for future "Manual Trigger" button */}
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
          Initialize Test Workflow
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {workflows.map(wf => (
             <li key={wf.id}>
               <Link href={`/workflows/${wf.id}`} className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-semibold text-slate-800">{wf.patient}</span>
                      <span className="text-xs text-slate-400 font-mono">{wf.id}</span>
                    </div>
                    <p className="text-sm text-slate-500">{wf.type}</p>
                  </div>

                  <div className="flex items-center space-x-6">
                    <span className="text-sm text-slate-400">{wf.updated}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold
                      ${wf.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                        wf.status === 'failed' ? 'bg-red-100 text-red-700' : 
                        wf.status === 'waiting_approval' ? 'bg-amber-100 text-amber-700' : 
                        'bg-blue-100 text-blue-700'}`}>
                      {wf.status.replace('_', ' ')}
                    </span>
                    {/* Chevron affordance */}
                    <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
               </Link>
             </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
