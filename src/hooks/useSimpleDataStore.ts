import { useState, useEffect } from 'react';

// Simple in-memory data store for immediate functionality
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  steps: { text: string; completed: boolean }[];
  energy: 'deep' | 'shallow';
  deadline?: string;
  tags: string[];
  context?: string;
  location?: string;
  est_min?: number;
  est_most?: number;
  est_max?: number;
}

export interface Event {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location?: string;
  description?: string;
}

export interface Outcome {
  id: string;
  title: string;
  risks: { text: string; mitigation?: string }[];
}

export interface CapturedItem {
  id: string;
  content: string;
  source: 'text' | 'voice' | 'camera';
  processed: boolean;
  task_draft?: any;
  created_at: string;
}

export interface SimpleDataStore {
  tasks: Task[];
  events: Event[];
  outcomes: Outcome[];
  capturedItems: CapturedItem[];
}

// Initialize with some mock data
const initialData: SimpleDataStore = {
  tasks: [
    {
      id: '1',
      title: 'Review presentation slides',
      completed: false,
      steps: [
        { text: 'Review content for accuracy', completed: false },
        { text: 'Check formatting and design', completed: false },
        { text: 'Practice presentation flow', completed: false }
      ],
      energy: 'deep',
      deadline: new Date().toISOString().split('T')[0],
      tags: ['work', 'presentation'],
      est_min: 90,
      est_most: 120,
      est_max: 150
    },
    {
      id: '2',
      title: 'Update project documentation',
      completed: false,
      steps: [
        { text: 'Review current documentation', completed: true },
        { text: 'Add new features section', completed: false },
        { text: 'Update installation guide', completed: false }
      ],
      energy: 'shallow',
      tags: ['documentation', 'work'],
      est_min: 60,
      est_most: 90,
      est_max: 120
    },
    {
      id: '3',
      title: 'Schedule team meeting',
      completed: true,
      steps: [
        { text: 'Check team availability', completed: true },
        { text: 'Send calendar invite', completed: true },
        { text: 'Prepare agenda', completed: true }
      ],
      energy: 'shallow',
      tags: ['meeting', 'team'],
      est_min: 15,
      est_most: 20,
      est_max: 30
    }
  ],
  events: [
    {
      id: '1',
      title: 'Team Standup',
      start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      end_at: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString(), // 2.5 hours from now
      location: 'Conference Room A'
    },
    {
      id: '2',
      title: 'Client Review Meeting',
      start_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
      end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
      location: 'Zoom',
      description: 'Review latest design mockups with client'
    }
  ],
  outcomes: [
    {
      id: '1',
      title: 'Complete quarterly presentation',
      risks: [
        {
          text: 'Presentation may run over time',
          mitigation: 'Practice timing and prepare shorter version'
        },
        {
          text: 'Technical demos might fail',
          mitigation: 'Test all demos beforehand and have backup slides'
        }
      ]
    },
    {
      id: '2',
      title: 'Launch new feature by Friday',
      risks: [
        {
          text: 'Integration tests may reveal bugs',
          mitigation: 'Start testing early in the week'
        },
        {
          text: 'Documentation might be incomplete',
          mitigation: 'Assign dedicated time for documentation'
        }
      ]
    }
  ],
  capturedItems: []
};

export function useSimpleDataStore() {
  const [data, setData] = useState<SimpleDataStore>(initialData);
  const [loading, setLoading] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('day-foundry-data');
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        setData(parsedData);
      } catch (error) {
        console.error('Failed to parse stored data:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('day-foundry-data', JSON.stringify(data));
  }, [data]);

  const updateTask = (id: string, updates: Partial<Task>) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.id === id ? { ...task, ...updates } : task
      )
    }));
  };

  const createTask = (task: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString()
    };
    setData(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask]
    }));
  };

  const deleteTask = (id: string) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(task => task.id !== id)
    }));
  };

  const createOutcome = (outcome: Omit<Outcome, 'id'>) => {
    const newOutcome: Outcome = {
      ...outcome,
      id: Date.now().toString()
    };
    setData(prev => ({
      ...prev,
      outcomes: [...prev.outcomes, newOutcome]
    }));
  };

  const createEvent = (event: Omit<Event, 'id'>) => {
    const newEvent: Event = {
      ...event,
      id: Date.now().toString()
    };
    setData(prev => ({
      ...prev,
      events: [...prev.events, newEvent]
    }));
  };

  const createCapturedItem = (item: Omit<CapturedItem, 'id' | 'created_at'>) => {
    const newItem: CapturedItem = {
      ...item,
      id: Date.now().toString(),
      created_at: new Date().toISOString()
    };
    setData(prev => ({
      ...prev,
      capturedItems: [...prev.capturedItems, newItem]
    }));
    return newItem.id;
  };

  const refresh = () => {
    // For the simple data store, this is a no-op since data is already local
    // But we keep the interface consistent with the real DataStore
  };

  return {
    data: {
      tasks: data.tasks,
      events: data.events,
      outcomes: data.outcomes,
      capturedItems: data.capturedItems,
      settings: null
    },
    loading,
    syncStatus: 'up-to-date' as const,
    createTask,
    updateTask,
    deleteTask,
    createOutcome,
    createEvent,
    createCapturedItem,
    refresh,
    saveSchedule: async () => { },
    updateSettings: async () => { },
    acceptTaskDraft: async (task: any) => {
      // For the simple store, just create a regular task
      const newTask = {
        ...task,
        id: Date.now().toString(),
        completed: false
      };
      setData(prev => ({
        ...prev,
        tasks: [...prev.tasks, newTask]
      }));
      return newTask.id;
    },
    recordPlanActual: async () => {
      // For the simple store, this is a no-op
      return 'mock-history-id';
    },
    authManager: {
      getSession: async () => ({ access_token: 'mock-token' }),
      getAccessToken: () => 'mock-token'
    }
  };
}

export { useSimpleDataStore as useDataStore };