// This is the acceptTaskDraft method that should be added to the DataStore class

  // Accept Task Draft - Converts task_draft to a Task and removes the captured item
  async acceptTaskDraft(capturedItemId: string): Promise<string> {
    const user = await authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // First get the captured item with its task draft
      const capturedItems = await this.getCapturedItems();
      const capturedItem = capturedItems.find(item => item.id === capturedItemId);
      
      if (!capturedItem) {
        throw new Error('Captured item not found');
      }

      if (!capturedItem.task_draft) {
        throw new Error('No task draft found for this captured item');
      }

      const { task_draft } = capturedItem;

      // Create the task from the draft
      const taskId = generateId();
      
      // Map est_range string to min/most/max values
      const estRangeMap: Record<string, { min: number; most: number; max: number }> = {
        '15-30 min': { min: 15, most: 22, max: 30 },
        '30-60 min': { min: 30, most: 45, max: 60 },
        '1-2 hours': { min: 60, most: 90, max: 120 },
        '2-4 hours': { min: 120, most: 180, max: 240 },
        '4+ hours': { min: 240, most: 300, max: 480 }
      };

      const estRange = estRangeMap[task_draft.est_range] || { min: 30, most: 45, max: 60 };

      const newTask: Task = {
        id: taskId,
        user_id: user.id,
        title: task_draft.title,
        steps: task_draft.steps.map(step => ({ text: step, completed: false })),
        acceptance: task_draft.acceptance,
        est_min: estRange.min,
        est_most: estRange.most,
        est_max: estRange.max,
        energy: task_draft.energy === 'Deep' ? 'deep' : 'shallow',
        deadline: task_draft.deadline ? task_draft.deadline.toISOString() : undefined,
        tags: task_draft.tags,
        context: undefined,
        location: undefined,
        source: 'task_draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Create the task using direct Supabase operation
      const operation = async () => {
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .insert(newTask)
          .select()
          .single();

        if (taskError) {
          console.error('Failed to create task from draft:', taskError);
          throw taskError;
        }

        // Mark the captured item as processed and remove task_draft
        const { error: updateError } = await supabase
          .from('captured_items')
          .update({
            processed: true,
            task_draft: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', capturedItemId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Failed to update captured item:', updateError);
          // Don't throw here as the task was created successfully
        }

        return taskData;
      };

      const taskData = await withTimeout(operation(), { 
        timeoutMs: 10000, 
        timeoutMessage: 'Accept task draft operation timed out' 
      });

      this.lastServerAckTs = Date.now();
      this.updateSyncStatus();
      
      return taskData.id;
    } catch (error) {
      console.error('Failed to accept task draft:', error);
      throw error;
    }
  }