'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);

  useEffect(() => {
    // In a real app we'd fetch this from the API proxy
    // For now we'll mock the state visually to get the layout clean
    setStats({
      active: 4,
      pendingApproval: 1,
      completed: 12
    });

    setWorkflows([
      { id: 'wf_101', type: 'pre_visit_intake', status: 'waiting_approval', patient: 'John Doe', updated: '2 mins ago' },
      { id: 'wf_102', type: 'pre_visit_intake', status: 'in_progress', patient: 'Jane Smith', updated: '15 mins ago' },
      { id: 'wf_103', type: 'pre_visit_intake', status: 'completed', patient: 'Bob Wilson', updated: '1 hr ago' },
    ]);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">System Overview</h2>
        <p className="text-slate-500 mt-2 text-sm">Real-time status of all orchestrated A2A workflows.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <span className="text-slate-500 text-sm font-medium">Active Workflows</span>
          <span className="text-4xl font-bold text-slate-800 mt-2">{stats?.active || '-'}</span>
        </div>
        <div className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-100 flex flex-col ring-1 ring-amber-400/20">
          <span className="text-amber-700 text-sm font-medium">Pending Approvals</span>
          <span className="text-4xl font-bold text-amber-600 mt-2">{stats?.pendingApproval || '-'}</span>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col">
          <span className="text-emerald-700 text-sm font-medium">Completed Today</span>
          <span className="text-4xl font-bold text-emerald-600 mt-2">{stats?.completed || '-'}</span>
        </div>
      </div>

      {/* Recent Workflows Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h3 className="font-semibold text-slate-800">Recent Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs tracking-wider uppercase">
                <th className="px-6 py-4 font-medium">Workflow ID</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Patient</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Last Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {workflows.map((wf) => (
                <tr key={wf.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs">{wf.id}</td>
                  <td className="px-6 py-4">{wf.type}</td>
                  <td className="px-6 py-4 font-medium">{wf.patient}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                      ${wf.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                        wf.status === 'waiting_approval' ? 'bg-amber-100 text-amber-700 animate-pulse' : 
                        'bg-blue-100 text-blue-700'}`}>
                      {wf.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{wf.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
