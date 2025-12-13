'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function FraudDebugger() {
  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/debug-fraud');
      if (response.ok) {
        const data = await response.json();
        setDebugData(data.debug);
        toast.success('Debug data loaded');
      } else {
        toast.error('Failed to load debug data');
      }
    } catch (error) {
      console.error('Error fetching debug data:', error);
      toast.error('Error loading debug data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-100">Fraud Detection Debugger</h3>
          <p className="text-gray-400 mt-1">
            Check if device fingerprinting is working correctly
          </p>
        </div>
        <Button
          onClick={fetchDebugData}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Run Debug Check'}
        </Button>
      </div>

      {debugData && (
        <>
          {/* Settings Status */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100">Settings Status</CardTitle>
              <CardDescription>Current fraud detection configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg ${debugData.settings.enabled.deviceFingerprinting ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {debugData.settings.enabled.deviceFingerprinting ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-semibold text-white">Device Fingerprinting</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    {debugData.settings.enabled.deviceFingerprinting ? 'Enabled ✓' : 'Disabled ✗'}
                  </p>
                </div>

                <div className={`p-4 rounded-lg ${debugData.settings.enabled.multiAccountDetection ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {debugData.settings.enabled.multiAccountDetection ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-semibold text-white">Multi-Account Detection</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    {debugData.settings.enabled.multiAccountDetection ? 'Enabled ✓' : 'Disabled ✗'}
                  </p>
                </div>

                <div className={`p-4 rounded-lg ${debugData.settings.enabled.vpnDetection ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {debugData.settings.enabled.vpnDetection ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-semibold text-white">VPN Detection</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    {debugData.settings.enabled.vpnDetection ? 'Enabled ✓' : 'Disabled ✗'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="text-sm text-gray-400">Max Accounts Per Device</div>
                  <div className="text-2xl font-bold text-yellow-400 mt-1">
                    {debugData.settings.thresholds.maxAccountsPerDevice}
                  </div>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="text-sm text-gray-400">Alert Threshold</div>
                  <div className="text-2xl font-bold text-orange-400 mt-1">
                    {debugData.settings.thresholds.alertThreshold}
                  </div>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="text-sm text-gray-400">Entry Block Threshold</div>
                  <div className="text-2xl font-bold text-red-400 mt-1">
                    {debugData.settings.thresholds.entryBlockThreshold}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100">Database Statistics</CardTitle>
              <CardDescription>What's actually in your database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400">
                    {debugData.statistics.totalFingerprints}
                  </div>
                  <div className="text-sm text-gray-300 mt-1">Total Device Fingerprints</div>
                  {debugData.statistics.totalFingerprints === 0 && (
                    <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      No fingerprints captured!
                    </div>
                  )}
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-400">
                    {debugData.statistics.fingerprintsWithMultipleAccounts}
                  </div>
                  <div className="text-sm text-gray-300 mt-1">Devices with Multiple Accounts</div>
                  {debugData.statistics.fingerprintsWithMultipleAccounts === 0 && (
                    <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      No multi-accounting detected yet
                    </div>
                  )}
                </div>

                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-red-400">
                    {debugData.statistics.totalAlerts}
                  </div>
                  <div className="text-sm text-gray-300 mt-1">Total Fraud Alerts</div>
                  {debugData.statistics.totalAlerts === 0 && (
                    <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      No alerts triggered yet
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Fingerprints */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100">Recent Device Fingerprints</CardTitle>
              <CardDescription>Last 20 devices tracked</CardDescription>
            </CardHeader>
            <CardContent>
              {debugData.recentFingerprints.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-3" />
                  <h3 className="text-lg font-semibold text-red-400 mb-2">
                    ⚠️ NO FINGERPRINTS FOUND!
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Device fingerprinting is not capturing data. This means:
                  </p>
                  <div className="text-left max-w-md mx-auto space-y-2 text-sm text-gray-300">
                    <div>• The fingerprint API is not being called</div>
                    <div>• JavaScript is being blocked</div>
                    <div>• The hook is not triggering</div>
                    <div>• Database connection issue</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {debugData.recentFingerprints.map((fp: any) => (
                    <div key={fp.id} className="bg-gray-900 p-3 rounded-lg border border-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-mono text-gray-400">{fp.fingerprintId}</span>
                            <Badge variant={fp.linkedAccountsCount > 0 ? 'destructive' : 'secondary'}>
                              {fp.linkedAccountsCount + 1} account(s)
                            </Badge>
                            {fp.riskScore > 0 && (
                              <Badge variant="warning">Risk: {fp.riskScore}</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-300">
                            <strong>User:</strong> {fp.userId} | 
                            <strong> Device:</strong> {fp.device}
                          </div>
                          {fp.linkedAccountsCount > 0 && (
                            <div className="text-xs text-yellow-400 mt-1">
                              🚨 Linked to {fp.linkedAccountsCount} other account(s)
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(fp.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Alerts */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100">Recent Fraud Alerts</CardTitle>
              <CardDescription>Last 20 alerts generated</CardDescription>
            </CardHeader>
            <CardContent>
              {debugData.recentAlerts.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Info className="h-12 w-12 mx-auto text-blue-500 mb-3" />
                  <p>No fraud alerts have been generated yet.</p>
                  <p className="text-sm mt-2">
                    {debugData.statistics.totalFingerprints > 0 
                      ? 'Fingerprints are being tracked, but no thresholds exceeded yet.'
                      : 'Start by getting some device fingerprints tracked first.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {debugData.recentAlerts.map((alert: any) => (
                    <div key={alert.id} className="bg-gray-900 p-3 rounded-lg border border-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={
                              alert.severity === 'critical' ? 'destructive' :
                              alert.severity === 'high' ? 'destructive' :
                              alert.severity === 'medium' ? 'warning' : 'secondary'
                            }>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <span className="font-semibold text-white">{alert.title}</span>
                          </div>
                          <div className="text-sm text-gray-300">{alert.description}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Users: {alert.suspiciousUserIds.join(', ')}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(alert.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Diagnosis */}
          {debugData.statistics.totalFingerprints === 0 && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-red-400">🚨 Diagnosis: Fingerprinting Not Working</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-gray-300">
                <p className="font-semibold">Possible causes:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Device fingerprinting API (<code>/api/fraud/track-device</code>) is not being called during signup</li>
                  <li>JavaScript errors preventing fingerprint generation</li>
                  <li>Users are signing up but fingerprint tracking fails silently</li>
                  <li>Browser security settings blocking fingerprinting</li>
                </ol>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 mt-4">
                  <p className="font-semibold text-blue-400 mb-2">Quick Fix Steps:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Open browser console (F12) during signup</li>
                    <li>Look for any errors related to fingerprint</li>
                    <li>Check if <code>POST /api/fraud/track-device</code> is called</li>
                    <li>Verify the request completes successfully (200 status)</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

