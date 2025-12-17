import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Activity } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

export interface ValidationReport {
    accuracy: number;
    constraints: Array<{
        name: string;
        status: 'pass' | 'fail' | 'adjusted';
        details?: string;
    }>;
}

interface ValidationReportSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    report: ValidationReport | null;
}

export function ValidationReportSheet({ open, onOpenChange, report }: ValidationReportSheetProps) {
    if (!report) return null;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pass': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case 'adjusted': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'fail': return <XCircle className="w-5 h-5 text-red-500" />;
            default: return <Activity className="w-5 h-5 text-gray-500" />;
        }
    };

    const getAccuracyColor = (score: number) => {
        if (score >= 90) return 'text-green-500';
        if (score >= 70) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[60vh] rounded-t-[20px]">
                <SheetHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <SheetTitle className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-[var(--df-primary)]" />
                                Guardrails Audit
                            </SheetTitle>
                            <SheetDescription>
                                Verification of schedule constraints & rules
                            </SheetDescription>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xs uppercase text-muted-foreground font-semibold">Accuracy</span>
                            <span className={`text-2xl font-bold ${getAccuracyColor(report.accuracy)}`}>
                                {report.accuracy}%
                            </span>
                        </div>
                    </div>
                </SheetHeader>

                <ScrollArea className="h-full py-4 pr-4">
                    <div className="space-y-4 pb-8">
                        {report.constraints.map((constraint, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--df-subtle)]/50 border border-[var(--df-border)]">
                                <div className="mt-0.5 shrink-0">
                                    {getStatusIcon(constraint.status)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-medium text-sm text-[var(--df-text)]">
                                            {constraint.name}
                                        </h4>
                                        <Badge variant="outline" className={`text-[10px] uppercase ${constraint.status === 'pass' ? 'border-green-200 text-green-700 bg-green-50' :
                                                constraint.status === 'adjusted' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' :
                                                    'border-red-200 text-red-700 bg-red-50'
                                            }`}>
                                            {constraint.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-[var(--df-text-muted)]">
                                        {constraint.details || 'Rule checks passed successfully.'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
