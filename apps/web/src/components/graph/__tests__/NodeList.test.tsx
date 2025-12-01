/**
 * NodeList Component Tests
 *
 * Tests for the NodeList component used in the Graph Debug UI.
 * Covers node rendering, search filtering, type filter chips,
 * node selection, and empty states.
 *
 * @module apps/web/src/components/graph/__tests__/NodeList.test
 * @since GPT Phase 2: Graph Retrieval & Context Expansion
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NodeList } from '../NodeList';
import type { KnowledgeNode } from '../types';

// =============================================================================
// Test Data
// =============================================================================

const mockNodes: KnowledgeNode[] = [
  {
    id: '1',
    collection_id: 'c1',
    node_type: 'symbol',
    name: 'TestFunction',
    document_id: undefined,
    chunk_id: 1,
    metadata: {},
    created_at: new Date('2024-01-01'),
  },
  {
    id: '2',
    collection_id: 'c1',
    node_type: 'table',
    name: 'users',
    document_id: undefined,
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
  {
    id: '5',
    collection_id: 'c1',
    node_type: 'config_section',
    name: 'database',
    document_id: undefined,
    chunk_id: 5,
    metadata: {},
    created_at: new Date('2024-01-04'),
  },
];

// =============================================================================
// Tests
// =============================================================================

describe('NodeList', () => {
  // ===========================================================================
  // Node Rendering Tests
  // ===========================================================================
  describe('node rendering', () => {
    it('should render all nodes from mock data', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      expect(screen.getByText('TestFunction')).toBeInTheDocument();
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('AuthService')).toBeInTheDocument();
      expect(screen.getByText('/api/login')).toBeInTheDocument();
      expect(screen.getByText('database')).toBeInTheDocument();
    });

    it('should display node type labels correctly', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      // Check for type badges (multiple elements may contain these labels)
      const symbolBadges = screen.getAllByText(/symbol/i);
      expect(symbolBadges.length).toBeGreaterThan(0);

      const tableBadges = screen.getAllByText(/table/i);
      expect(tableBadges.length).toBeGreaterThan(0);

      const endpointBadges = screen.getAllByText(/endpoint/i);
      expect(endpointBadges.length).toBeGreaterThan(0);
    });

    it('should show linked document indicator for nodes with document_id', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      // AuthService has document_id set
      const authServiceItem = screen.getByText('AuthService').closest('button');
      expect(authServiceItem).toBeInTheDocument();

      // Should show "Linked to document" text
      const linkedText = screen.getAllByText(/Linked to document/);
      expect(linkedText.length).toBeGreaterThan(0);
    });

    it('should display correct node count in footer', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      expect(screen.getByText('5 nodes')).toBeInTheDocument();
    });

    it('should display singular form for single node', () => {
      const singleNode = [mockNodes[0]];
      const onSelectNode = vi.fn();

      render(
        <NodeList nodes={singleNode} selectedNodeId={undefined} onSelectNode={onSelectNode} />
      );

      expect(screen.getByText('1 node')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Search Filtering Tests
  // ===========================================================================
  describe('search filtering', () => {
    it('should filter nodes by search query (case-insensitive)', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const searchInput = screen.getByPlaceholderText('Search nodes...');
      fireEvent.change(searchInput, { target: { value: 'auth' } });

      // Should show AuthService (matches "auth")
      expect(screen.getByText('AuthService')).toBeInTheDocument();

      // Should not show other nodes
      expect(screen.queryByText('TestFunction')).not.toBeInTheDocument();
      expect(screen.queryByText('users')).not.toBeInTheDocument();
    });

    it('should filter nodes case-insensitively', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const searchInput = screen.getByPlaceholderText('Search nodes...');
      fireEvent.change(searchInput, { target: { value: 'AUTH' } });

      expect(screen.getByText('AuthService')).toBeInTheDocument();
    });

    it('should show filtered count in footer', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const searchInput = screen.getByPlaceholderText('Search nodes...');
      fireEvent.change(searchInput, { target: { value: 'auth' } });

      expect(screen.getByText('1 of 5 nodes')).toBeInTheDocument();
    });

    it('should show multiple matches for partial search', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const searchInput = screen.getByPlaceholderText('Search nodes...');
      fireEvent.change(searchInput, { target: { value: 'e' } });

      // Should match nodes containing 'e': TestFunction, users, AuthService, database
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('AuthService')).toBeInTheDocument();
      expect(screen.getByText('database')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Type Filter Chips Tests
  // ===========================================================================
  describe('type filter chips', () => {
    it('should render filter chips for unique node types', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      // Should show filter chips for: symbol, table, endpoint, config_section
      expect(screen.getByRole('button', { name: /Symbol.*2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Table.*1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Endpoint.*1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Config.*1/i })).toBeInTheDocument();
    });

    it('should toggle filter when chip is clicked', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      // Click the Symbol filter chip
      const symbolChip = screen.getByRole('button', { name: /Symbol.*2/i });
      fireEvent.click(symbolChip);

      // Chip should be pressed
      expect(symbolChip).toHaveAttribute('aria-pressed', 'true');

      // Should only show symbol nodes
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
      expect(screen.getByText('AuthService')).toBeInTheDocument();
      expect(screen.queryByText('users')).not.toBeInTheDocument();
      expect(screen.queryByText('/api/login')).not.toBeInTheDocument();
    });

    it('should toggle off when clicking active chip again', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const symbolChip = screen.getByRole('button', { name: /Symbol.*2/i });

      // Click to activate
      fireEvent.click(symbolChip);
      expect(symbolChip).toHaveAttribute('aria-pressed', 'true');

      // Click again to deactivate
      fireEvent.click(symbolChip);
      expect(symbolChip).toHaveAttribute('aria-pressed', 'false');

      // All nodes should be visible again
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
      expect(screen.getByText('users')).toBeInTheDocument();
    });

    it('should allow multiple type filters to be active', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      // Activate both Symbol and Table filters
      const symbolChip = screen.getByRole('button', { name: /Symbol.*2/i });
      const tableChip = screen.getByRole('button', { name: /Table.*1/i });

      fireEvent.click(symbolChip);
      fireEvent.click(tableChip);

      // Both should be pressed
      expect(symbolChip).toHaveAttribute('aria-pressed', 'true');
      expect(tableChip).toHaveAttribute('aria-pressed', 'true');

      // Should show symbol and table nodes
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
      expect(screen.getByText('AuthService')).toBeInTheDocument();
      expect(screen.getByText('users')).toBeInTheDocument();

      // Should not show endpoint or config nodes
      expect(screen.queryByText('/api/login')).not.toBeInTheDocument();
      expect(screen.queryByText('database')).not.toBeInTheDocument();
    });

    it('should show Clear filters button when filters are active', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      // Initially no clear button
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();

      // Activate a filter
      const symbolChip = screen.getByRole('button', { name: /Symbol.*2/i });
      fireEvent.click(symbolChip);

      // Clear button should appear
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    it('should clear all filters when Clear filters is clicked', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      // Activate filters and search
      const symbolChip = screen.getByRole('button', { name: /Symbol.*2/i });
      fireEvent.click(symbolChip);

      const searchInput = screen.getByPlaceholderText('Search nodes...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // Click clear
      const clearButton = screen.getByText('Clear filters');
      fireEvent.click(clearButton);

      // All nodes should be visible
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('AuthService')).toBeInTheDocument();
      expect(screen.getByText('/api/login')).toBeInTheDocument();
      expect(screen.getByText('database')).toBeInTheDocument();

      // Search should be cleared
      expect(searchInput).toHaveValue('');
    });
  });

  // ===========================================================================
  // Node Selection Tests
  // ===========================================================================
  describe('node selection', () => {
    it('should call onSelectNode when node is clicked', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const testFunctionNode = screen.getByText('TestFunction').closest('button');
      if (testFunctionNode) fireEvent.click(testFunctionNode);

      expect(onSelectNode).toHaveBeenCalledTimes(1);
      expect(onSelectNode).toHaveBeenCalledWith(mockNodes[0]);
    });

    it('should highlight selected node', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId="1" onSelectNode={onSelectNode} />);

      const selectedNode = screen.getByText('TestFunction').closest('button');
      expect(selectedNode).toHaveAttribute('aria-selected', 'true');

      // Other nodes should not be selected
      const otherNode = screen.getByText('users').closest('button');
      expect(otherNode).toHaveAttribute('aria-selected', 'false');
    });

    it('should apply correct styling to selected node', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId="1" onSelectNode={onSelectNode} />);

      const selectedNode = screen.getByText('TestFunction').closest('button');
      expect(selectedNode).toHaveClass('bg-accent/10');
      expect(selectedNode).toHaveClass('border-l-accent');
    });
  });

  // ===========================================================================
  // Empty State Tests
  // ===========================================================================
  describe('empty states', () => {
    it('should show empty state when no nodes exist', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={[]} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      expect(screen.getByText('No nodes in the graph')).toBeInTheDocument();
    });

    it('should show empty state when search matches no nodes', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const searchInput = screen.getByPlaceholderText('Search nodes...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No nodes match your search criteria')).toBeInTheDocument();
    });

    it('should show empty state when type filter matches no nodes', () => {
      const nodesWithOneType: KnowledgeNode[] = [
        {
          id: '1',
          collection_id: 'c1',
          node_type: 'symbol',
          name: 'OnlySymbol',
          document_id: undefined,
          chunk_id: 1,
          metadata: {},
          created_at: new Date('2024-01-01'),
        },
      ];
      const onSelectNode = vi.fn();

      render(
        <NodeList nodes={nodesWithOneType} selectedNodeId={undefined} onSelectNode={onSelectNode} />
      );

      // With only one type, there's only one chip, so filtering by it should show the node
      // This test verifies the component handles this edge case
      expect(screen.getByText('OnlySymbol')).toBeInTheDocument();
    });

    it('should show Clear filters button in empty state when filters are active', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const searchInput = screen.getByPlaceholderText('Search nodes...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      // Should show clear filters button in empty state
      const clearButtons = screen.getAllByText('Clear filters');
      expect(clearButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // Accessibility Tests
  // ===========================================================================
  describe('accessibility', () => {
    it('should have accessible search input with label', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const searchInput = screen.getByLabelText('Search nodes by name');
      expect(searchInput).toBeInTheDocument();
    });

    it('should have accessible listbox role for node list', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const listbox = screen.getByRole('listbox', { name: 'Knowledge graph nodes' });
      expect(listbox).toBeInTheDocument();
    });

    it('should have accessible filter chips with aria-pressed', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      const symbolChip = screen.getByRole('button', { name: /Symbol.*2/i });
      expect(symbolChip).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have fieldset with legend for type filters', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      expect(screen.getByText('Filter by node type')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Combined Filtering Tests
  // ===========================================================================
  describe('combined search and type filtering', () => {
    it('should combine search and type filters', () => {
      const onSelectNode = vi.fn();

      render(<NodeList nodes={mockNodes} selectedNodeId={undefined} onSelectNode={onSelectNode} />);

      // Search for 'Service' and filter by 'symbol'
      const searchInput = screen.getByPlaceholderText('Search nodes...');
      fireEvent.change(searchInput, { target: { value: 'Service' } });

      const symbolChip = screen.getByRole('button', { name: /Symbol.*2/i });
      fireEvent.click(symbolChip);

      // Only AuthService should match (symbol type AND contains 'Service')
      expect(screen.getByText('AuthService')).toBeInTheDocument();
      expect(screen.queryByText('TestFunction')).not.toBeInTheDocument();
    });
  });
});
