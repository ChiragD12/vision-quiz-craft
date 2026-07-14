import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { load, DB } from "@/lib/store";
import { runDatabaseHealthAudit, DatabaseHealthReport } from "@/lib/db-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/debug")({
  component: DebugPage,
});

function DebugPage() {
  const [report, setReport] = useState<DatabaseHealthReport | null>(null);

  const runAudit = useCallback(() => {
    const db: DB = load();
    const result = runDatabaseHealthAudit(db);
    setReport(result);
  }, []);

  const copyReport = () => {
    if (report) navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  };

  const exportReport = () => {
    if (report) {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "db-health-report.json";
      a.click();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Database Diagnostics</h1>
        <div className="space-x-2">
          <Button onClick={runAudit}>Run Health Audit</Button>
          <Button variant="outline" onClick={copyReport} disabled={!report}>
            Copy Report
          </Button>
          <Button variant="outline" onClick={exportReport} disabled={!report}>
            Export JSON
          </Button>
        </div>
      </div>

      {report ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                Status
                <Badge variant={report.healthy ? "default" : "destructive"}>
                  {report.healthy ? "Healthy" : "Issues Found"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(report.counts).map(([key, count]) => (
                  <div key={key} className="p-4 border rounded">
                    <div className="text-sm text-gray-500 capitalize">{key}</div>
                    <div className="text-2xl font-bold">{count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-500">Errors ({report.errors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-4 space-y-1">
                  {report.errors.map((e, i) => (
                    <li key={i} className="text-sm">
                      {e.description}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-yellow-500">
                  Warnings ({report.warnings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-4 space-y-1">
                  {report.warnings.map((w, i) => (
                    <li key={i} className="text-sm">
                      {w.description}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Click "Run Health Audit" to inspect the database.</p>
      )}
    </div>
  );
}
