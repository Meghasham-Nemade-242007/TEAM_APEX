import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  Cpu,
  User,
  Info,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { systemAPI } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    gemini_configured?: boolean;
    version?: string;
  } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const checkHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await systemAPI.health();
      setHealthStatus(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backend health check failed';
      setHealthError(msg);
      setHealthStatus({ status: 'offline', gemini_configured: false });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy tracking-tight">System & Account Settings</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Configuration parameters, artificial intelligence backend status, and profile information.
        </p>
      </div>

      {/* 1. API Status Card */}
      <Card
        title="Backend & AI Engine Status"
        subtitle="Verification of core inference microservices and judicial analysis models"
        headerActions={
          <Button
            variant="secondary"
            size="sm"
            onClick={checkHealth}
            isLoading={healthLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Check Health
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backend Service Status */}
            <div className="p-4 rounded-lg border border-border bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-light text-blue-primary flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-navy">API Gateway Service</h4>
                  <p className="text-[11px] text-text-secondary">FastAPI Core Server</p>
                </div>
              </div>
              <div>
                {healthLoading ? (
                  <Spinner size="sm" color="#0866C6" />
                ) : healthStatus?.status === 'ok' || healthStatus?.status === 'healthy' ? (
                  <Badge variant="success" size="sm">Online</Badge>
                ) : (
                  <Badge variant="error" size="sm">Unreachable</Badge>
                )}
              </div>
            </div>

            {/* Gemini / LLM Status */}
            <div className="p-4 rounded-lg border border-border bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-light text-blue-primary flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-navy">Gemini Legal LLM</h4>
                  <p className="text-[11px] text-text-secondary">Statutory extraction model</p>
                </div>
              </div>
              <div>
                {healthLoading ? (
                  <Spinner size="sm" color="#0866C6" />
                ) : healthStatus?.gemini_configured ? (
                  <Badge variant="success" size="sm">Configured</Badge>
                ) : (
                  <Badge variant="warning" size="sm">API Key Needed</Badge>
                )}
              </div>
            </div>
          </div>

          {healthError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-error flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>Could not contact backend at http://localhost:8000/api/health. Ensure the server is running.</span>
            </div>
          )}
        </div>
      </Card>

      {/* 2. Account Information */}
      <Card title="Account Profile" subtitle="Your authenticated legal analyst credentials">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Full Name
              </label>
              <div className="p-2.5 bg-slate-50 border border-border rounded-md text-xs font-semibold text-navy flex items-center gap-2">
                <User className="w-4 h-4 text-text-secondary" />
                <span>{user?.full_name || 'Legal Analyst'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Official Email
              </label>
              <div className="p-2.5 bg-slate-50 border border-border rounded-md text-xs font-mono text-navy">
                {user?.email || 'analyst@portal.gov'}
              </div>
            </div>
          </div>

          <div className="pt-2 text-xs text-text-secondary flex items-center gap-2">
            <Shield className="w-4 h-4 text-success" />
            <span>Authenticated with JWT token authorization.</span>
          </div>
        </div>
      </Card>

      {/* 3. Application Specifications */}
      <Card title="Application Specifications" subtitle="System limits and operational tolerances">
        <div className="divide-y divide-border text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-text-secondary">Portal Version</span>
            <span className="font-mono text-navy font-semibold">1.0.0 (Production Release)</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-text-secondary">Supported File Ingestion Formats</span>
            <span className="font-medium text-navy">Portable Document Format (.pdf)</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-text-secondary">Maximum Allowed File Payload</span>
            <span className="font-mono text-navy font-medium">50 Megabytes (MB)</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-text-secondary">Citation Anchoring Resolution</span>
            <span className="text-navy font-medium">Page-level & Exact passage extracts</span>
          </div>
        </div>
      </Card>

      {/* 4. Privacy & Confidentiality Notice */}
      <Card title="Confidentiality & Privacy Notice">
        <div className="flex items-start gap-3 text-xs leading-relaxed text-text-secondary">
          <Lock className="w-5 h-5 text-navy shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p>
              All court records, depositions, and legal documents uploaded to this portal are processed inside an isolated judicial execution environment.
            </p>
            <p>
              Uploaded briefs are not retained for external public model fine-tuning. Strict cryptographic access controls govern access to parsed documents and generated analyses.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
