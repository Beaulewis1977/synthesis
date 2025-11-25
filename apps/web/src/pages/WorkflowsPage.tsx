import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Loader2,
  Pause,
  Play,
  Plus,
  XCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import type { WorkflowInstance } from '../types';

export function WorkflowsPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const queryClient = useQueryClient();
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [taskDescription, setTaskDescription] = useState('');

  // Fetch collection details
  const { data: collectionData } = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: () => apiClient.fetchCollection(collectionId ?? ''),
    enabled: !!collectionId,
  });

  // Fetch workflows
  const { data: workflowsData, isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows', collectionId],
    queryFn: () => apiClient.getWorkflows(collectionId ?? ''),
    enabled: !!collectionId,
  });

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => apiClient.getWorkflowTemplates(),
  });

  // Create workflow mutation
  const createWorkflowMutation = useMutation({
    mutationFn: () =>
      apiClient.createWorkflow({
        collection_id: collectionId ?? '',
        template_id: selectedTemplate || undefined,
        task_description: taskDescription,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', collectionId] });
      setShowNewWorkflow(false);
      setSelectedTemplate(null);
      setTaskDescription('');
    },
  });

  // Execute step mutation
  const executeStepMutation = useMutation({
    mutationFn: (workflowId: string) => apiClient.executeWorkflowStep(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', collectionId] });
    },
  });

  const workflows = workflowsData?.workflows || [];
  const templates = templatesData?.templates || [];

  const getStatusIcon = (status: WorkflowInstance['status']) => {
    switch (status) {
      case 'active':
        return <Play className="text-accent" size={16} />;
      case 'paused':
        return <Pause className="text-warning" size={16} />;
      case 'completed':
        return <CheckCircle className="text-success" size={16} />;
      case 'failed':
        return <XCircle className="text-error" size={16} />;
      default:
        return <Clock className="text-text-secondary" size={16} />;
    }
  };

  const getStatusLabel = (status: WorkflowInstance['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  if (!collectionId) {
    return (
      <div className="card bg-red-50 border-error">
        <AlertCircle className="text-error" size={24} />
        <p className="text-error">Collection ID is required</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-lg">
        <Link
          to={`/collections/${collectionId}`}
          className="text-accent hover:underline mb-md inline-block"
        >
          ← Back to {collectionData?.name || 'Collection'}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-sm">
              <Zap className="text-accent" size={28} />
              Workflows
            </h1>
            <p className="text-text-secondary mt-xs">
              Task-oriented retrieval workflows for structured problem solving
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewWorkflow(true)}
            className="btn btn-primary flex items-center gap-xs"
          >
            <Plus size={18} />
            New Workflow
          </button>
        </div>
      </div>

      {/* New Workflow Form */}
      {showNewWorkflow && (
        <div className="card mb-lg">
          <h3 className="font-semibold text-text-primary mb-md">Create New Workflow</h3>

          {/* Template Selection */}
          <div className="mb-md">
            <span className="block text-sm font-medium text-text-secondary mb-sm">
              Select Template (optional)
            </span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-sm">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() =>
                    setSelectedTemplate(selectedTemplate === template.id ? null : template.id)
                  }
                  className={`p-sm rounded-lg border text-left transition-all ${
                    selectedTemplate === template.id
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-accent/50'
                  }`}
                >
                  <span className="font-medium text-sm block">{template.name}</span>
                  <span className="text-xs text-text-secondary">{template.category}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Task Description */}
          <div className="mb-md">
            <label
              htmlFor="task-description"
              className="block text-sm font-medium text-text-secondary mb-sm"
            >
              Task Description *
            </label>
            <textarea
              id="task-description"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Describe what you want to accomplish..."
              className="input w-full min-h-[100px]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={() => createWorkflowMutation.mutate()}
              disabled={!taskDescription.trim() || createWorkflowMutation.isPending}
              className="btn btn-primary flex items-center gap-xs"
            >
              {createWorkflowMutation.isPending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              Create Workflow
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewWorkflow(false);
                setSelectedTemplate(null);
                setTaskDescription('');
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>

          {createWorkflowMutation.isError && (
            <div className="mt-md text-sm text-error bg-red-50 p-3 rounded-md">
              Failed to create workflow. Please try again.
            </div>
          )}
        </div>
      )}

      {/* Workflows List */}
      {workflowsLoading ? (
        <div className="flex items-center justify-center py-xl">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      ) : workflows.length === 0 ? (
        <div className="card text-center py-xl">
          <Zap className="mx-auto text-text-secondary mb-md" size={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-sm">No workflows yet</h3>
          <p className="text-text-secondary mb-md">
            Create a workflow to start structured problem solving with RAG.
          </p>
          <button
            type="button"
            onClick={() => setShowNewWorkflow(true)}
            className="btn btn-primary"
          >
            Create Your First Workflow
          </button>
        </div>
      ) : (
        <div className="space-y-md">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-sm mb-xs">
                    {getStatusIcon(workflow.status)}
                    <span className="text-sm font-medium text-text-secondary">
                      {getStatusLabel(workflow.status)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-text-primary mb-xs">
                    {workflow.task_description.slice(0, 100)}
                    {workflow.task_description.length > 100 ? '...' : ''}
                  </h3>
                  <div className="flex items-center gap-md text-sm text-text-secondary">
                    <span>Started: {new Date(workflow.started_at).toLocaleDateString()}</span>
                    {workflow.completed_steps.length > 0 && (
                      <span>{workflow.completed_steps.length} steps completed</span>
                    )}
                  </div>

                  {/* Progress */}
                  {workflow.status === 'active' && workflow.current_step_id && (
                    <div className="mt-sm flex items-center gap-xs text-sm text-accent">
                      <ChevronRight size={14} />
                      Current step: {workflow.current_step_id}
                    </div>
                  )}

                  {/* Findings preview */}
                  {workflow.findings.length > 0 && (
                    <div className="mt-sm">
                      <span className="text-xs text-text-secondary">
                        {workflow.findings.length} finding(s)
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-sm">
                  {workflow.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => executeStepMutation.mutate(workflow.id)}
                      disabled={executeStepMutation.isPending}
                      className="btn btn-sm btn-primary flex items-center gap-xs"
                    >
                      {executeStepMutation.isPending ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                      Next Step
                    </button>
                  )}
                </div>
              </div>

              {/* Final Output */}
              {workflow.final_output && (
                <div className="mt-md pt-md border-t border-border">
                  <h4 className="text-sm font-medium text-text-secondary mb-xs">Result</h4>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">
                    {workflow.final_output}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
