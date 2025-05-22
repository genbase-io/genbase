"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plate, TPlateEditor, usePlateEditor } from '@udecode/plate/react';
import { Editor, EditorContainer } from "../ui/editor";
import { Button } from "../ui/button";
import { Send } from "lucide-react";
import { useChatEditorContent } from "../../lib/store";


import { MentionPlugin } from '@udecode/plate-mention/react';


interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isSending: boolean;
  isDisabled: boolean;
  sessionId?: string | null;
}



export function ChatInput({ onSendMessage, isSending, isDisabled, sessionId }: ChatInputProps) {
  const [isEmpty, setIsEmpty] = useState(true);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const { content, setContent, clearContent } = useChatEditorContent(sessionId);
  const isUpdatingFromExternal = useRef(false);

  // Slash commands
  const slashCommands = [
    { key: 'plan', label: 'Plan Infrastructure', command: '/plan' },
    { key: 'merge', label: 'Merge Changes', command: '/merge' },
  ];

  // Parse content safely
  const parseContent = (content: string) => {
    try {
      return content ? JSON.parse(content) : [{ type: 'p', children: [{ text: '' }] }];
    } catch {
      return [{ type: 'p', children: [{ text: '' }] }];
    }
  };

  // Initialize Plate editor (simple setup without slash plugin for now)
  const editor: TPlateEditor = usePlateEditor({
    value: parseContent(content || ''),
    plugins: [
  MentionPlugin,
]
  });

  // Handle editor value changes
  const handleEditorChange = useCallback((value: any) => {
    if (isUpdatingFromExternal.current) return;

    const serializedValue = JSON.stringify(value);
    
    // Check if editor is empty
    const isEditorEmpty = value.length === 1 && 
      value[0].children?.length === 1 && 
      value[0].children[0].text === '';
    
    setIsEmpty(isEditorEmpty);
    
    // Check for slash trigger
    const text = value[0]?.children?.[0]?.text || '';
    if (text.endsWith('/')) {
      // Show slash menu
      setShowSlashMenu(true);
      // You'd calculate proper position here in a real implementation
      setSlashMenuPosition({ x: 100, y: 100 });
    } else {
      setShowSlashMenu(false);
    }
    
    // Store content in Zustand
    if (sessionId) {
      setContent(serializedValue);
    }
  }, [sessionId, setContent]);

  // Sync external content changes to editor
  useEffect(() => {
    if (editor && sessionId && content !== undefined) {
      try {
        const currentValue = JSON.stringify(editor.children);
        
        if (currentValue !== content) {
          isUpdatingFromExternal.current = true;
          
          const newValue = parseContent(content);
          editor.tf.setValue(newValue);
          
          const isEditorEmpty = newValue.length === 1 && 
            newValue[0].children?.length === 1 && 
            newValue[0].children[0].text === '';
          setIsEmpty(isEditorEmpty);
          
          setTimeout(() => {
            isUpdatingFromExternal.current = false;
          }, 10);
        }
      } catch (error) {
        console.error('Error syncing content:', error);
      }
    }
  }, [editor, sessionId, content]);

  // Clear content when session is null
  useEffect(() => {
    if (editor && !sessionId) {
      editor.tf.setValue([{ type: 'p', children: [{ text: '' }] }]);
      setIsEmpty(true);
    }
  }, [editor, sessionId]);

  // Extract plain text from editor value
  const getPlainText = useCallback(() => {
    if (!editor) return '';
    
    const extractText = (nodes: any[]): string => {
      return nodes.map(node => {
        if (node.text !== undefined) {
          return node.text;
        }
        if (node.children) {
          return extractText(node.children);
        }
        return '';
      }).join('');
    };
    
    return extractText(editor.children);
  }, [editor]);

  // Handle slash command selection
  const handleSlashCommand = (command: string) => {
    if (editor) {
      const currentText = getPlainText();
      // Replace the trailing '/' with the command
      const newText = currentText.slice(0, -1) + command;
      
      setShowSlashMenu(false);
      
      // Send the command immediately
      onSendMessage(newText.trim());
      
      // Clear the editor
      editor.tf.setValue([{ type: 'p', children: [{ text: '' }] }]);
      if (sessionId) {
        clearContent();
      }
      
      // Focus back to editor
      setTimeout(() => {
        editor.tf.focus();
      }, 10);
    }
  };

  const handleSend = useCallback(() => {
    if (!editor || isEmpty || isSending || isDisabled) return;
    
    const textContent = getPlainText().trim();
    if (!textContent) return;

    onSendMessage(textContent);
    
    editor.tf.setValue([{ type: 'p', children: [{ text: '' }] }]);
    if (sessionId) {
      clearContent();
    }
    
    setTimeout(() => {
      editor.tf.focus();
    }, 10);
  }, [editor, isEmpty, isSending, isDisabled, onSendMessage, sessionId, clearContent, getPlainText]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (showSlashMenu) {
      if (event.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
      // Handle arrow keys and enter for menu navigation
      // This is a simplified version - you'd want proper menu navigation
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend, showSlashMenu]);

  if (!editor) {
    return (
      <div className="p-3 border-t flex items-center justify-center bg-card flex-shrink-0">
        <div className="text-sm text-muted-foreground">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="border-t bg-card flex-shrink-0 relative">
      {/* Slash Menu */}
      {showSlashMenu && (
        <div 
          className="absolute bottom-full left-4 mb-2 bg-popover border rounded-md shadow-md py-1 z-50 min-w-48"
          style={{ 
            transform: 'translateY(-4px)'
          }}
        >
          {slashCommands.map((cmd) => (
            <button
              key={cmd.key}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center"
              onClick={() => handleSlashCommand(cmd.command)}
            >
              <span className="font-medium">{cmd.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{cmd.command}</span>
            </button>
          ))}
        </div>
      )}

      {/* Editor Container */}
      <div 
        className="relative"
        onKeyDown={handleKeyDown}
      >
        <Plate 
          editor={editor}
          onChange={({ value }) => handleEditorChange(value)}
        >
          <EditorContainer className={`min-h-[60px] max-h-[200px] overflow-y-auto ${
            isSending || isDisabled ? 'opacity-50 pointer-events-none' : ''
          }`}>
            <Editor 
              placeholder="Type your message... (use / for commands)"
              className="p-3 text-sm focus:outline-none"
            />
          </EditorContainer>
        </Plate>
      </div>
      
      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-muted-foreground">
            Press Enter to send, / for commands
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            size="sm"
            disabled={isEmpty || isSending || isDisabled}
            onClick={handleSend}
            aria-label="Send message"
            className="h-8"
          >
            {isSending ? (
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}