import React, { useState, useRef, useEffect } from 'react';
import { PenLine, Plus, Check, X, Trash2 } from 'lucide-react';

export default function CategoryTabs({
  tabs,
  activeTabId,
  setActiveTabId,
  renameTab,
  onAddNewTab,
  onDeleteTabRequest,
  onOpenSettings,
  isReadOnlyViewer = false,
}) {
  const [editingTabId, setEditingTabId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTabName, setNewTabName] = useState('');

  const editInputRef = useRef(null);
  const addInputRef = useRef(null);

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  useEffect(() => {
    if (isAddingNew && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAddingNew]);

  const startEditing = (tab, e) => {
    if (isReadOnlyViewer) return;
    e.stopPropagation();
    setEditingTabId(tab.id);
    setTempName(tab.name || tab.defaultName);
  };

  const handleSaveRename = (tabId) => {
    if (tempName.trim()) {
      renameTab(tabId, tempName.trim());
    }
    setEditingTabId(null);
  };

  const handleSaveNewTab = () => {
    if (newTabName.trim()) {
      onAddNewTab(newTabName.trim());
    }
    setIsAddingNew(false);
    setNewTabName('');
  };

  const handleDeleteTab = (tab, e) => {
    e.stopPropagation();
    if (onDeleteTabRequest) {
      onDeleteTabRequest(tab);
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-3 pt-2 no-print">
      {/* Category Tabs List */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = editingTabId === tab.id;

          return (
            <div
              key={tab.id}
              onClick={() => !isEditing && setActiveTabId(tab.id)}
              className={`group relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none border-t-2 border-x ${
                isActive
                  ? 'bg-white text-blue-600 border-t-blue-600 border-x-slate-200/90 shadow-2xs z-10'
                  : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent hover:bg-white/50'
              }`}
            >
              {isEditing ? (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={editInputRef}
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(tab.id);
                      if (e.key === 'Escape') setEditingTabId(null);
                    }}
                    className="bg-white border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none w-24 sm:w-28"
                  />
                  <button
                    onClick={() => handleSaveRename(tab.id)}
                    className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </button>
                  <button
                    onClick={() => setEditingTabId(null)}
                    className="p-1 rounded bg-slate-100 text-slate-500 hover:text-slate-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="truncate">{tab.name || tab.defaultName}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 sm:hidden" />
                  )}

                  {!isReadOnlyViewer && (
                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      {/* Rename Button */}
                      <button
                        onClick={(e) => startEditing(tab, e)}
                        title="Rename category"
                        className="p-0.5 rounded text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Tab Button (Requires Encrypted Password) */}
                      {tabs.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteTab(tab, e)}
                          title="Delete category (Password '7722' required)"
                          className="p-0.5 rounded text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Add Tab Inline Input */}
        {isAddingNew && !isReadOnlyViewer && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-t-xl px-3 py-1.5 shadow-2xs">
            <input
              ref={addInputRef}
              type="text"
              placeholder="Tab name..."
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNewTab();
                if (e.key === 'Escape') setIsAddingNew(false);
              }}
              className="border border-blue-400 rounded px-2 py-0.5 text-xs text-slate-800 outline-none w-32"
            />
            <button
              onClick={handleSaveNewTab}
              className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsAddingNew(false)}
              className="p-1 rounded bg-slate-100 text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Right side: + Add Tab button (Owner only) */}
      {!isReadOnlyViewer && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600 stroke-[2.5]" />
            <span>Add Tab</span>
          </button>
        </div>
      )}
    </div>
  );
}
