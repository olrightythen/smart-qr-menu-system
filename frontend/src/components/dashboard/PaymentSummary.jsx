// Create: frontend/src/components/dashboard/PaymentSummary.jsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";

export default function PaymentSummary() {
  const [paymentData, setPaymentData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, token } = useAuth();

  useEffect(() => {
    if (user?.id && token) {
      fetchPaymentData();
    }
  }, [user, token]);

  const fetchPaymentData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/payment-summary/`,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch payment data");
      }

      const data = await response.json();
      setPaymentData(data);
    } catch (err) {
      console.error("Error fetching payment data:", err);
      setError("Could not load payment data");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "paid":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      case "pending":
        return "text-yellow-500";
      default:
        return "text-gray-500";
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading payment data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !paymentData) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="text-center text-muted-foreground">
          <p>{error || "No payment data available"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-6 border-b border-border flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-green-500" />
        <h2 className="text-xl font-semibold">Payment Summary</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Payment Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Successful
              </span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(paymentData.successful_payments)}
            </p>
            <p className="text-xs text-green-600 dark:text-green-500">
              {paymentData.successful_count} transactions
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                Failed
              </span>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">
              {formatCurrency(paymentData.failed_payments)}
            </p>
            <p className="text-xs text-red-600 dark:text-red-500">
              {paymentData.failed_count} transactions
            </p>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Pending
              </span>
            </div>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {formatCurrency(paymentData.pending_payments)}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              {paymentData.pending_count} transactions
            </p>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-background/50 rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Payment Success Rate</span>
            <span className="text-lg font-bold text-green-500">
              {paymentData.success_rate}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${paymentData.success_rate}%` }}
            />
          </div>
        </div>

        {/* Recent Transactions */}
        {paymentData.recent_transactions &&
          paymentData.recent_transactions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Recent Transactions
              </h3>
              <div className="space-y-3">
                {paymentData.recent_transactions.map((transaction, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(transaction.status)}
                      <div>
                        <p className="font-medium text-sm">
                          {transaction.invoice_no}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(
                            transaction.created_at
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(transaction.amount)}
                      </p>
                      <p
                        className={`text-xs capitalize ${getStatusColor(
                          transaction.status
                        )}`}
                      >
                        {transaction.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Payment Methods */}
        {paymentData.payment_methods && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Payment Methods</h3>
            <div className="space-y-2">
              {Object.entries(paymentData.payment_methods).map(
                ([method, data], index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-blue-500" />
                      <span className="font-medium capitalize">{method}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(data.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data.count} transactions
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
