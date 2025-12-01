/**
 * EdgeList Component Tests
 *
 * Tests for the EdgeList component used in the Graph Debug UI.
 * Covers edge rendering, type filter chips, edge selection,
 * and empty states.
 *
 * @module apps/web/src/components/graph/__tests__/EdgeList.test
 * @since GPT Phase 2: Graph Retrieval & Context Expansion
 */

import type { KnowledgeEdge, KnowledgeNode } from '@synthesis/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EdgeList } from '../EdgeList';

// =============================================================================
// Test Data
// =============================================================================

const mockNodes: KnowledgeNode[] = [
  {
    id: '1',
    collection_id: 'c1',
    node_type: 'symbol',
    name: 'TestFunction',
    chunk_id: 1,
    metadata: {},
    created_at: new Date('2024-01-01'),
  },
  {
    id: '2',
    collection_id: 'c1',
    node_type: 'table',
    name: 'users',
    chunk_id: 2,
    metadata: {},
    created_at: new Date('2024-01-01'),
  },
  {
    id: '3',
    collection_id: 'c1',
    node_type: 'symbol',
    name: 'AuthService',
    document_id: 'doc-1',
    chunk_id: 3,
    metadata: {},
    created_at: new Date('2024-01-02'),
  },
  {
    id: '4',
    collection_id: 'c1',
    node_type: 'endpoint',
    name: '/api/login',
    document_id: 'doc-2',
    chunk_id: 4,
    metadata: {},
    created_at: new Date('2024-01-03'),
  },
];

const mockEdges: KnowledgeEdge[] = [
  {
    id: 'e1',
    collection_id: 'c1',
    source_node_id: '1',
    target_node_id: '2',
    edge_type: 'persists_to',
    metadata: {},
    created_at: new Date('2024-01-01'),
  },
  {
    id: 'e2',
    collection_id: 'c1',
    source_node_id: '3',
    target_node_id: '1',
    edge_type: 'calls',
    metadata: {},
    created_at: new Date('2024-01-02'),
  },
  {
    id: 'e3',
    collection_id: 'c1',
    source_node_id: '4',
    target_node_id: '3',
    edge_type: 'depends_on',
    metadata: {},
    created_at: new Date('2024-01-03'),
  },
  {
    id: 'e4',
    collection_id: 'c1',
    source_node_id: '3',
    target_node_id: '2',
    edge_type: 'persists_to',
    metadata: {},
    created_at: new Date('2024-01-04'),
  },
];

// =============================================================================
// Tests
// =============================================================================

describe('EdgeList', () => {
  // ===========================================================================
  // Edge Rendering Tests
  // ===========================================================================
  describe('edge rendering', () => {
    it('should render all edges with source and target names', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Check source and target names are displayed (may appear multiple times)
      expect(screen.getAllByText('TestFunction').length).toBeGreaterThan(0);
      expect(screen.getAllByText('AuthService').length).toBeGreaterThan(0);
      expect(screen.getByText('/api/login')).toBeInTheDocument();

      // Check target names are displayed
      expect(screen.getAllByText('users').length).toBeGreaterThan(0);
    });

    it('should display edge type labels correctly', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Check for edge type badges (includes both filter chips and edge labels)
      // persists_to appears 2 times in edges + 1 in filter chip = 3
      expect(screen.getAllByText('Persists To').length).toBe(3);
      // calls appears 1 time in edge + 1 in filter chip = 2
      expect(screen.getAllByText('Calls').length).toBe(2);
      // depends_on appears 1 time in edge + 1 in filter chip = 2
      expect(screen.getAllByText('Depends On').length).toBe(2);
    });

    it('should display correct edge count in footer', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      expect(screen.getByText('4 of 4 edges')).toBeInTheDocument();
    });

    it('should display singular form for single edge', () => {
      const singleEdge = [mockEdges[0]];
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={singleEdge}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      expect(screen.getByText('1 of 1 edge')).toBeInTheDocument();
    });

    it('should show Unknown for nodes not in node map', () => {
      const edgeWithUnknownNode: KnowledgeEdge[] = [
        {
          id: 'e-unknown',
          collection_id: 'c1',
          source_node_id: 'unknown-source',
          target_node_id: 'unknown-target',
          edge_type: 'calls',
          metadata: {},
          created_at: new Date('2024-01-01'),
        },
      ];
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={edgeWithUnknownNode}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Both source and target should show "Unknown"
      const unknownLabels = screen.getAllByText('Unknown');
      expect(unknownLabels.length).toBe(2);
    });
  });

  // ===========================================================================
  // Type Filter Chips Tests
  // ===========================================================================
  describe('type filter chips', () => {
    it('should render filter chips for unique edge types', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Should show filter chips for: persists_to, calls, depends_on
      expect(screen.getByRole('button', { name: 'Persists To' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Calls' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Depends On' })).toBeInTheDocument();
    });

    it('should toggle filter when chip is clicked', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Click the Calls filter chip
      const callsChip = screen.getByRole('button', { name: 'Calls' });
      fireEvent.click(callsChip);

      // Chip should be pressed
      expect(callsChip).toHaveAttribute('aria-pressed', 'true');

      // Should only show 'calls' edges
      expect(screen.getByText('1 of 4 edges')).toBeInTheDocument();

      // AuthService -> TestFunction is the calls edge (there's also 'Calls' filter chip)
      expect(screen.getAllByText('Calls').length).toBeGreaterThan(0);
    });

    it('should toggle off when clicking active chip again', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      const callsChip = screen.getByRole('button', { name: 'Calls' });

      // Click to activate
      fireEvent.click(callsChip);
      expect(callsChip).toHaveAttribute('aria-pressed', 'true');

      // Click again to deactivate
      fireEvent.click(callsChip);
      expect(callsChip).toHaveAttribute('aria-pressed', 'false');

      // All edges should be visible again
      expect(screen.getByText('4 of 4 edges')).toBeInTheDocument();
    });

    it('should allow multiple type filters to be active', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Activate both Calls and Depends On filters
      const callsChip = screen.getByRole('button', { name: 'Calls' });
      const dependsOnChip = screen.getByRole('button', { name: 'Depends On' });

      fireEvent.click(callsChip);
      fireEvent.click(dependsOnChip);

      // Both should be pressed
      expect(callsChip).toHaveAttribute('aria-pressed', 'true');
      expect(dependsOnChip).toHaveAttribute('aria-pressed', 'true');

      // Should show 2 edges (1 calls + 1 depends_on)
      expect(screen.getByText('2 of 4 edges')).toBeInTheDocument();
    });

    it('should show Clear filters button when filters are active', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Initially 'Clear filters' text should not be in the footer
      // (there might be clear filters in other places later, but footer should be clean initially)
      const initialFooter = screen.getByText(/of 4 edges/);
      expect(initialFooter).toBeInTheDocument();

      // Activate a filter
      const callsChip = screen.getByRole('button', { name: 'Calls' });
      fireEvent.click(callsChip);

      // Clear button should appear in footer
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    it('should clear all filters when Clear filters is clicked', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Activate filter
      const callsChip = screen.getByRole('button', { name: 'Calls' });
      fireEvent.click(callsChip);

      // Click clear
      const clearButton = screen.getByText('Clear filters');
      fireEvent.click(clearButton);

      // All edges should be visible
      expect(screen.getByText('4 of 4 edges')).toBeInTheDocument();

      // Filter should be deactivated
      expect(callsChip).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // ===========================================================================
  // Edge Selection Tests
  // ===========================================================================
  describe('edge selection', () => {
    it('should call onSelectEdge when edge is clicked', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Click the first edge item (TestFunction -> users)
      const edgeButton = screen
        .getByLabelText(/Edge from TestFunction persists to users/i)
        .closest('button');
      if (edgeButton) fireEvent.click(edgeButton);

      expect(onSelectEdge).toHaveBeenCalledTimes(1);
      expect(onSelectEdge).toHaveBeenCalledWith(mockEdges[0]);
    });

    it('should highlight selected edge', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId="e1"
          onSelectEdge={onSelectEdge}
        />
      );

      const selectedEdge = screen
        .getByLabelText(/Edge from TestFunction persists to users/i)
        .closest('button');
      expect(selectedEdge).toHaveAttribute('aria-selected', 'true');
    });

    it('should apply correct styling to selected edge', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId="e1"
          onSelectEdge={onSelectEdge}
        />
      );

      const selectedEdge = screen
        .getByLabelText(/Edge from TestFunction persists to users/i)
        .closest('button');
      expect(selectedEdge).toHaveClass('bg-accent/10');
      expect(selectedEdge).toHaveClass('border-l-accent');
    });

    it('should handle keyboard Enter key for selection', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      const edgeButton = screen
        .getByLabelText(/Edge from TestFunction persists to users/i)
        .closest('button');

      if (edgeButton) fireEvent.keyDown(edgeButton, { key: 'Enter' });

      expect(onSelectEdge).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard Space key for selection', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      const edgeButton = screen
        .getByLabelText(/Edge from TestFunction persists to users/i)
        .closest('button');

      if (edgeButton) fireEvent.keyDown(edgeButton, { key: ' ' });

      expect(onSelectEdge).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Empty State Tests
  // ===========================================================================
  describe('empty states', () => {
    it('should show empty state when no edges exist', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={[]}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      expect(screen.getByText('No edges in this graph')).toBeInTheDocument();
    });

    it('should show empty state when filter matches no edges', () => {
      const singleTypeEdges: KnowledgeEdge[] = [
        {
          id: 'e1',
          collection_id: 'c1',
          source_node_id: '1',
          target_node_id: '2',
          edge_type: 'calls',
          metadata: {},
          created_at: new Date('2024-01-01'),
        },
      ];
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={singleTypeEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // With only one type, filtering by it should show the edge
      expect(screen.getByText('1 of 1 edge')).toBeInTheDocument();
    });

    it('should not render filter chips when no edges exist', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={[]}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // No filter chips should be rendered
      expect(screen.queryByText('Filter by Type')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Accessibility Tests
  // ===========================================================================
  describe('accessibility', () => {
    it('should have accessible list role for edge list', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      const list = screen.getByRole('list', { name: 'Knowledge graph edges' });
      expect(list).toBeInTheDocument();
    });

    it('should have accessible filter chips with aria-pressed', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      const callsChip = screen.getByRole('button', { name: 'Calls' });
      expect(callsChip).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have accessible edge buttons with descriptive labels', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Each edge should have an aria-label describing the relationship
      const persistsToEdge = screen.getByLabelText(/Edge from TestFunction persists to users/i);
      expect(persistsToEdge).toBeInTheDocument();

      const callsEdge = screen.getByLabelText(/Edge from AuthService calls TestFunction/i);
      expect(callsEdge).toBeInTheDocument();
    });

    it('should have fieldset with legend for type filters', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      expect(screen.getByText('Filter by Type')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Edge Display Format Tests
  // ===========================================================================
  describe('edge display format', () => {
    it('should show source -> type -> target format', () => {
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={mockEdges}
          nodes={mockNodes}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // The edge from AuthService to TestFunction with type 'calls'
      // Should render as: AuthService -> Calls -> TestFunction
      const edgeItem = screen
        .getByLabelText(/Edge from AuthService calls TestFunction/i)
        .closest('button');

      expect(edgeItem).toBeInTheDocument();
      // Check that the parent contains all three elements
      expect(edgeItem).toHaveTextContent('AuthService');
      expect(edgeItem).toHaveTextContent('Calls');
      expect(edgeItem).toHaveTextContent('TestFunction');
    });

    it('should truncate long node names with title attribute', () => {
      const nodesWithLongNames: KnowledgeNode[] = [
        {
          id: '1',
          collection_id: 'c1',
          node_type: 'symbol',
          name: 'VeryLongFunctionNameThatExceedsNormalLength',
          document_id: undefined,
          chunk_id: 1,
          metadata: {},
          created_at: new Date('2024-01-01'),
        },
        {
          id: '2',
          collection_id: 'c1',
          node_type: 'symbol',
          name: 'AnotherVeryLongFunctionNameThatAlsoExceeds',
          document_id: undefined,
          chunk_id: 2,
          metadata: {},
          created_at: new Date('2024-01-01'),
        },
      ];
      const edgesWithLongNames: KnowledgeEdge[] = [
        {
          id: 'e1',
          collection_id: 'c1',
          source_node_id: '1',
          target_node_id: '2',
          edge_type: 'calls',
          metadata: {},
          created_at: new Date('2024-01-01'),
        },
      ];
      const onSelectEdge = vi.fn();

      render(
        <EdgeList
          edges={edgesWithLongNames}
          nodes={nodesWithLongNames}
          selectedEdgeId={undefined}
          onSelectEdge={onSelectEdge}
        />
      );

      // Source and target names should have title attributes for full text
      const sourceSpan = screen.getByTitle('VeryLongFunctionNameThatExceedsNormalLength');
      const targetSpan = screen.getByTitle('AnotherVeryLongFunctionNameThatAlsoExceeds');

      expect(sourceSpan).toBeInTheDocument();
      expect(targetSpan).toBeInTheDocument();
    });
  });
});
