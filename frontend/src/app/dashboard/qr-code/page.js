"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import DashboardHeader from "@/components/dashboard/Header";
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
import { QRCodeSVG } from "qrcode.react";

export default function GenerateQR() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [tables, setTables] = useState([]);
  const [newTableName, setNewTableName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [isDeletingTable, setIsDeletingTable] = useState(null);
  const [isRegeneratingQR, setIsRegeneratingQR] = useState(null);
  const [error, setError] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [copyStatus, setCopyStatus] = useState({});

  const { user, token } = useAuth();
  const hostUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "";

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
        throw new Error("Failed to fetch tables");
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
        throw new Error("Failed to add table");
      }

      const data = await response.json();
      setTables([...tables, data.table]);
      setNewTableName("");
      toast.success("Table added successfully");
    } catch (error) {
      console.error("Error adding table:", error);
      toast.error("Failed to add table");
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
        throw new Error("Failed to delete table");
      }

      setTables(tables.filter((table) => table.id !== id));
      toast.success("Table deleted successfully");
    } catch (error) {
      console.error("Error deleting table:", error);
      toast.error("Failed to delete table");
    } finally {
      setIsDeletingTable(null);
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
        throw new Error("Failed to regenerate QR code");
      }

      const data = await response.json();

      // Update the specific table with new QR code
      setTables(
        tables.map((table) =>
          table.id === id ? { ...table, qr_code: data.qr_code } : table
        )
      );

      toast.success("QR code regenerated");
    } catch (error) {
      console.error("Error regenerating QR code:", error);
      toast.error("Failed to regenerate QR code");
    } finally {
      setIsRegeneratingQR(null);
    }
  };

  const downloadQRCode = (table) => {
    const canvas = document.getElementById(`qr-code-${table.id}`);
    if (!canvas) return;

    const pngUrl = canvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");

    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `${table.name.replace(/\s+/g, "-")}-qr-code.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const copyQRLink = (table) => {
    const qrLink = `${hostUrl}/menu/${user.id}/${table.id}`;

    navigator.clipboard.writeText(qrLink).then(
      () => {
        setCopyStatus({ ...copyStatus, [table.id]: true });
        toast.success("Link copied to clipboard");

        // Reset copy status after 2 seconds
        setTimeout(() => {
          setCopyStatus({ ...copyStatus, [table.id]: false });
        }, 2000);
      },
      () => {
        toast.error("Failed to copy link");
      }
    );
  };

  const shareQRCode = (table) => {
    const qrLink = `${hostUrl}/menu/${user.id}/${table.id}`;

    setSelectedTable({
      ...table,
      shareUrl: qrLink,
    });
    setShowDialog(true);
  };

  const handleShare = async () => {
    if (!selectedTable) return;

    const shareUrl = selectedTable.shareUrl;

    if (navigator.share) {
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
      }
    } else {
      // Fallback for browsers that don't support the Web Share API
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
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div
        className={`${
          isSidebarOpen ? "lg:ml-64" : "lg:ml-20"
        } transition-all duration-300`}
      >
        <DashboardHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold">
                Table QR Manager
              </h1>
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
                  <label className="text-sm font-medium mb-2 block">
                    Table Name/Number
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder="e.g., Table 4"
                      disabled={isAddingTable}
                    />
                    <Button
                      onClick={addTable}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      disabled={isAddingTable}
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
                    <li>• Print QR codes in high quality</li>
                    <li>• Place QR codes visibly on tables</li>
                    <li>• Test scan before final placement</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-semibold mb-4">
                QR Code Instructions
              </h2>
              <div className="space-y-4 text-sm">
                <p>
                  1. Create a table by entering a name in the form on the left.
                </p>
                <p>
                  2. Each table receives a unique QR code that customers can
                  scan.
                </p>
                <p>
                  3. Download the QR code as a PNG file for printing or digital
                  display.
                </p>
                <p>
                  4. When a customer scans the QR code, they'll see your menu
                  instantly.
                </p>
                <p>
                  5. You can regenerate QR codes if needed (this invalidates old
                  codes).
                </p>
                <p className="font-medium text-orange-500">
                  Tip: Print QR codes at least 2 x 2 inches (5 x 5 cm) for
                  optimal scanning.
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
                  onClick={() =>
                    document.getElementById("new-table-input").focus()
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Table
                </Button>
              </div>
            ) : (
              tables.map((table) => (
                <div
                  key={table.id}
                  className="bg-card rounded-xl border border-border p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">{table.name}</h3>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => regenerateQR(table.id)}
                        className="text-orange-500"
                        disabled={isRegeneratingQR === table.id}
                      >
                        {isRegeneratingQR === table.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTable(table.id)}
                        className="text-red-500"
                        disabled={isDeletingTable === table.id}
                      >
                        {isDeletingTable === table.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="aspect-square bg-white rounded-lg flex items-center justify-center p-4 mb-4">
                    <QRCode
                      id={`qr-code-${table.id}`}
                      value={`${hostUrl}/menu/${user.id}/${table.id}`}
                      size={180}
                      level={"H"}
                      includeMargin={true}
                      imageSettings={{
                        src: "/logo192.png",
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
      </div>

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
                  <QRCode
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
              {navigator.share ? "Share" : "Copy & Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
