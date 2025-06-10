"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode,
  Download,
  Copy,
  Share2,
  Plus,
  Trash2,
  HelpCircle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Edit3,
  Check,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

export default function GenerateQR() {
  const [tables, setTables] = useState([]);
  const [newTableName, setNewTableName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [isDeletingTable, setIsDeletingTable] = useState(null);
  const [isRegeneratingQR, setIsRegeneratingQR] = useState(null);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(null);
  const [error, setError] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [copyStatus, setCopyStatus] = useState({});
  const [isClient, setIsClient] = useState(false);

  // New states for renaming functionality
  const [editingTable, setEditingTable] = useState(null);
  const [editName, setEditName] = useState("");
  const [isRenamingTable, setIsRenamingTable] = useState(null);

  const { user, token } = useAuth();
  const hostUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "";

  // Add a ref for the input element
  const inputRef = useRef(null);

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if native sharing is available
  const hasNativeShare = isClient && typeof navigator !== 'undefined' && 'share' in navigator;

  // Fetch tables from backend
  useEffect(() => {
    if (user?.id && token) {
      fetchTables();
    } else {
      setIsLoading(false);
    }
  }, [user, token]);

  const fetchTables = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/tables/`,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch tables");
      }

      const data = await response.json();
      setTables(data.tables || []);
    } catch (error) {
      console.error("Error fetching tables:", error);
      setError("Failed to load tables. Please try again.");
      toast.error("Could not load your tables");
    } finally {
      setIsLoading(false);
    }
  };

  const addTable = async () => {
    if (!newTableName.trim()) {
      toast.error("Please enter a table name");
      return;
    }

    try {
      setIsAddingTable(true);
      setError(null);

      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/tables/add/`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newTableName,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to add table");
      }

      const data = await response.json();
      setTables([...tables, data.table]);
      setNewTableName("");
      toast.success("Table added successfully");
    } catch (error) {
      console.error("Error adding table:", error);
      toast.error(error.message || "Failed to add table");
    } finally {
      setIsAddingTable(false);
    }
  };

  const deleteTable = async (id) => {
    try {
      setIsDeletingTable(id);

      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/tables/${id}/delete/`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete table");
      }

      setTables(tables.filter((table) => table.id !== id));
      toast.success("Table deleted successfully");
    } catch (error) {
      console.error("Error deleting table:", error);
      toast.error(error.message || "Failed to delete table");
    } finally {
      setIsDeletingTable(null);
    }
  };

  const toggleTableAvailability = async (id, currentStatus) => {
    try {
      setIsTogglingAvailability(id);

      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/tables/${id}/toggle-availability/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !currentStatus,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Failed to toggle table availability"
        );
      }

      const data = await response.json();

      setTables(prevTables =>
        prevTables.map((table) =>
          table.id === id ? { ...table, is_active: data.table?.is_active ?? data.is_active } : table
        )
      );

      toast.success(
        `Table ${(data.table?.is_active ?? data.is_active) ? "activated" : "deactivated"} successfully`
      );
    } catch (error) {
      console.error("Error toggling table availability:", error);
      toast.error(error.message || "Failed to toggle table availability");
    } finally {
      setIsTogglingAvailability(null);
    }
  };

  const startEditing = (table) => {
    if (isRenamingTable || editingTable) {
      return;
    }
    setEditingTable(table.id);
    setEditName(table.name);
  };

  const cancelEditing = () => {
    setEditingTable(null);
    setEditName("");
  };

  const saveTableName = async (id) => {
    const trimmedName = editName.trim();
    
    if (!trimmedName) {
      toast.error("Table name cannot be empty");
      return;
    }

    const currentTable = tables.find((t) => t.id === id);
    if (!currentTable) {
      toast.error("Table not found");
      cancelEditing();
      return;
    }

    if (trimmedName === currentTable.name) {
      cancelEditing();
      return;
    }

    const nameExists = tables.some(
      (table) => table.id !== id && table.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (nameExists) {
      toast.error("A table with this name already exists");
      return;
    }

    try {
      setIsRenamingTable(id);

      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/tables/${id}/rename/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to rename table");
      }

      const data = await response.json();

      setTables(prevTables =>
        prevTables.map((table) =>
          table.id === id ? { ...table, name: data.table?.name ?? data.name } : table
        )
      );

      cancelEditing();
      toast.success("Table renamed successfully");
    } catch (error) {
      console.error("Error renaming table:", error);
      toast.error(error.message || "Failed to rename table");
    } finally {
      setIsRenamingTable(null);
    }
  };

  const regenerateQR = async (id) => {
    try {
      setIsRegeneratingQR(id);

      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/tables/${id}/regenerate-qr/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to regenerate QR code");
      }

      const data = await response.json();

      setTables(
        tables.map((table) =>
          table.id === id ? { ...table, qr_code: data.qr_code } : table
        )
      );

      toast.success("QR code regenerated");
    } catch (error) {
      console.error("Error regenerating QR code:", error);
      toast.error(error.message || "Failed to regenerate QR code");
    } finally {
      setIsRegeneratingQR(null);
    }
  };

  const getTableUrl = useCallback(
    (table) => {
      if (!hostUrl) {
        return `${window.location.protocol}//${window.location.host}/menu/${user.id}/${table.qr_code}`;
      }
      return `${hostUrl}/menu/${user.id}/${table.qr_code}`;
    },
    [hostUrl, user?.id]
  );

  const downloadQRCode = (table) => {
    try {
      const canvas = document.getElementById(`qr-code-${table.id}`);
      if (!canvas) {
        throw new Error("QR code canvas not found");
      }

      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");

      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `${table.name.replace(/\s+/g, "-")}-qr-code.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success("QR code downloaded successfully");
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast.error("Failed to download QR code");
    }
  };

  const copyQRLink = (table) => {
    const qrLink = getTableUrl(table);

    navigator.clipboard.writeText(qrLink).then(
      () => {
        setCopyStatus({ ...copyStatus, [table.id]: true });
        toast.success("Link copied to clipboard");

        setTimeout(() => {
          setCopyStatus((prevStatus) => ({ ...prevStatus, [table.id]: false }));
        }, 2000);
      },
      () => {
        toast.error("Failed to copy link");
      }
    );
  };

  const shareQRCode = (table) => {
    const qrLink = getTableUrl(table);

    setSelectedTable({
      ...table,
      shareUrl: qrLink,
    });
    setShowDialog(true);
  };

  const handleShare = async () => {
    if (!selectedTable) return;

    const shareUrl = selectedTable.shareUrl;

    if (hasNativeShare) {
      try {
        await navigator.share({
          title: `${user.restaurant_name || "Restaurant"} - ${
            selectedTable.name
          } Menu`,
          text: `Scan this QR code to view the menu for ${selectedTable.name}`,
          url: shareUrl,
        });
        setShowDialog(false);
      } catch (error) {
        console.error("Error sharing:", error);
        if (error.name !== "AbortError") {
          toast.error("Failed to share");
        }
      }
    } else {
      navigator.clipboard.writeText(shareUrl).then(
        () => {
          toast.success("Link copied to clipboard");
          setShowDialog(false);
        },
        () => {
          toast.error("Failed to copy link");
        }
      );
    }
  };

  return (
    <>
      <main className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold">Table QR Manager</h1>
            <p className="text-muted-foreground">
              Generate and manage QR codes for each table
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchTables}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Generate unique QR codes for each table.
                    <br />
                    Customers can scan to view the menu.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Add New Table */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">Add New Table</h2>

            <div className="space-y-4">
              <div>
                <label
                  className="text-sm font-medium mb-2 block"
                  htmlFor="new-table-input"
                >
                  Table Name/Number
                </label>
                <div className="flex space-x-2">
                  <Input
                    id="new-table-input"
                    ref={inputRef}
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="e.g., Table 4"
                    disabled={isAddingTable}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !isAddingTable &&
                        newTableName.trim()
                      ) {
                        addTable();
                      }
                    }}
                  />
                  <Button
                    onClick={addTable}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={isAddingTable || !newTableName.trim()}
                  >
                    {isAddingTable ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-medium mb-2">Quick Tips</h3>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Each QR code is unique to its table</li>
                  <li>• Toggle availability to control access</li>
                  <li>• Rename tables by clicking the edit icon</li>
                  <li>• Print QR codes in high quality</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">QR Code Instructions</h2>
            <div className="space-y-4 text-sm">
              <p>
                1. Create a table by entering a name in the form on the left.
              </p>
              <p>
                2. Each table receives a unique QR code that customers can scan.
              </p>
              <p>3. Toggle table availability to control customer access.</p>
              <p>4. Rename tables dynamically using the edit button.</p>
              <p>5. Download QR codes as PNG files for printing.</p>
              <p className="font-medium text-orange-500">
                Tip: Inactive tables will show "Currently Unavailable" to
                customers.
              </p>
            </div>
          </div>
        </div>

        {/* Table QR Codes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-muted-foreground">Loading tables...</p>
              </div>
            </div>
          ) : tables.length === 0 ? (
            <div className="col-span-full bg-card rounded-xl border border-border p-8 text-center">
              <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Tables Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first table to generate a QR code for it
              </p>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Table
              </Button>
            </div>
          ) : (
            tables.map((table) => (
              <div
                key={table.id}
                className={`bg-card rounded-xl border border-border p-6 ${
                  table.is_active === false ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  {/* Table Name with Edit Functionality */}
                  <div className="flex items-center gap-2 flex-1">
                    {editingTable === table.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !isRenamingTable) {
                              saveTableName(table.id);
                            } else if (e.key === "Escape") {
                              cancelEditing();
                            }
                          }}
                          disabled={isRenamingTable === table.id}
                          autoFocus
                          maxLength={50}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveTableName(table.id)}
                          disabled={isRenamingTable === table.id || !editName.trim()}
                          className="p-1 h-6 w-6"
                        >
                          {isRenamingTable === table.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3 text-green-500" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                          disabled={isRenamingTable === table.id}
                          className="p-1 h-6 w-6"
                        >
                          <X className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <h3 className="font-medium truncate">{table.name}</h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(table)}
                          disabled={isRenamingTable === table.id || editingTable !== null}
                          className="p-1 h-6 w-6"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              toggleTableAvailability(table.id, table.is_active)
                            }
                            className={`${
                              table.is_active !== false
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                            disabled={
                              isTogglingAvailability === table.id ||
                              editingTable === table.id ||
                              isRenamingTable === table.id
                            }
                          >
                            {isTogglingAvailability === table.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : table.is_active !== false ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {table.is_active !== false
                              ? "Deactivate table"
                              : "Activate table"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => regenerateQR(table.id)}
                            className="text-orange-500"
                            disabled={
                              isRegeneratingQR === table.id ||
                              editingTable === table.id ||
                              isRenamingTable === table.id
                            }
                          >
                            {isRegeneratingQR === table.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Regenerate QR code</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTable(table.id)}
                            className="text-red-500"
                            disabled={
                              isDeletingTable === table.id ||
                              editingTable === table.id ||
                              isRenamingTable === table.id
                            }
                          >
                            {isDeletingTable === table.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete table</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <div className="mb-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      table.is_active !== false
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {table.is_active !== false ? (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </span>
                </div>

                <div className="aspect-square bg-white rounded-lg flex items-center justify-center p-4 mb-4">
                  <QRCodeCanvas
                    id={`qr-code-${table.id}`}
                    value={getTableUrl(table)}
                    size={180}
                    level={"H"}
                    includeMargin={true}
                    imageSettings={{
                      x: undefined,
                      y: undefined,
                      height: 30,
                      width: 30,
                      excavate: true,
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => downloadQRCode(table)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PNG
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => copyQRLink(table)}
                  >
                    {copyStatus[table.id] ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => shareQRCode(table)}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Share Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share {selectedTable?.name} QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {selectedTable && (
              <>
                <div className="bg-white p-4 rounded-lg mb-4">
                  <QRCodeSVG
                    value={selectedTable.shareUrl}
                    size={150}
                    level={"H"}
                    includeMargin={true}
                  />
                </div>
                <p className="text-sm text-center mb-2">
                  Share this QR code with your guests to let them view the menu
                  for {selectedTable.name}.
                </p>
                <Input
                  className="mt-2"
                  value={selectedTable.shareUrl}
                  readOnly
                  onClick={(e) => e.target.select()}
                />
              </>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="sm:w-1/2"
              onClick={() => selectedTable && copyQRLink(selectedTable)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button
              className="sm:w-1/2 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4 mr-2" />
              {/* FIXED: Check hasNativeShare instead of navigator.share directly */}
              {hasNativeShare ? "Share" : "Copy & Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
