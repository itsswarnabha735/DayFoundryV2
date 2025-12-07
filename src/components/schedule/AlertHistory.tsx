import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Clock, AlertTriangle, CheckCircle, XCircle, Filter } from 'lucide-react';
import { useEdgeFunctions } from '../../hooks/useEdgeFunctions';
import { format } from 'date-fns';

interface AlertHistoryProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Alert {
    id: string;
    type: 'conflict' | 'warning' | 'suggestion';
    message: string;
    status: 'pending' | 'dismissed' | 'accepted' | 'resolved';
    created_at: string;
}

export function AlertHistory({ isOpen, onClose }: AlertHistoryProps) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');

    useEffect(() => {
        if (isOpen) {
            fetchAlerts();
        }
    }, [isOpen]);

    const fetchAlerts = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await (await import('../../utils/supabase/client')).supabase
                .from('schedule_alerts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setAlerts(data || []);
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredAlerts = alerts.filter(alert => {
        if (filter === 'all') return true;
        if (filter === 'resolved') return alert.status === 'resolved' || alert.status === 'accepted';
        return alert.status === filter;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending</Badge>;
            case 'resolved':
            case 'accepted':
                return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Resolved</Badge>;
            case 'dismissed':
                return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">Dismissed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'conflict':
                return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'warning':
                return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            default:
                return <Clock className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:w-[400px] border-l border-white/10 bg-black/95 backdrop-blur-xl">
                <SheetHeader>
                    <SheetTitle className="text-white flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Alert History
                    </SheetTitle>
                    <SheetDescription className="text-white/60">
                        View past schedule conflicts and alerts.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex gap-2 my-4 overflow-x-auto pb-2">
                    <Button
                        variant={filter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('all')}
                        className="text-xs"
                    >
                        All
                    </Button>
                    <Button
                        variant={filter === 'pending' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('pending')}
                        className="text-xs"
                    >
                        Pending
                    </Button>
                    <Button
                        variant={filter === 'resolved' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('resolved')}
                        className="text-xs"
                    >
                        Resolved
                    </Button>
                    <Button
                        variant={filter === 'dismissed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('dismissed')}
                        className="text-xs"
                    >
                        Dismissed
                    </Button>
                </div>

                <ScrollArea className="h-[calc(100vh-200px)] pr-4">
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center text-white/40 py-8">Loading history...</div>
                        ) : filteredAlerts.length === 0 ? (
                            <div className="text-center text-white/40 py-8">No alerts found.</div>
                        ) : (
                            filteredAlerts.map((alert) => (
                                <div key={alert.id} className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            {getTypeIcon(alert.type)}
                                            <span className="text-sm font-medium text-white capitalize">{alert.type}</span>
                                        </div>
                                        {getStatusBadge(alert.status)}
                                    </div>

                                    <p className="text-sm text-white/80 leading-relaxed">
                                        {alert.message}
                                    </p>

                                    <div className="text-xs text-white/40">
                                        {format(new Date(alert.created_at), 'MMM d, h:mm a')}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
