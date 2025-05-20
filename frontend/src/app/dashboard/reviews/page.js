"use client";

import { useState } from 'react';
import { Star, MessageSquare, ThumbsUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/Header';

const reviews = [
  {
    id: 1,
    customer: "Priya Sharma",
    avatar: "https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=50",
    rating: 5,
    comment: "Amazing food! The Butter Chicken was absolutely delicious. Will definitely order again!",
    date: "2 days ago",
    dish: "Butter Chicken",
    helpful: 12,
    replied: true
  },
  {
    id: 2,
    customer: "Amit Kumar",
    avatar: "https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=50",
    rating: 4,
    comment: "Great taste and quick delivery. The Masala Dosa was crispy and the chutney was perfect.",
    date: "1 week ago",
    dish: "Masala Dosa",
    helpful: 8,
    replied: false
  },
  {
    id: 3,
    customer: "Neha Singh",
    avatar: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=50",
    rating: 5,
    comment: "Best Paneer Tikka in town! The spices were perfectly balanced.",
    date: "2 weeks ago",
    dish: "Paneer Tikka",
    helpful: 15,
    replied: true
  }
];

export default function Reviews() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className={`${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} transition-all duration-300`}>
        <DashboardHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold">Customer Reviews</h1>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter Reviews
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <div className="text-4xl font-bold mb-2">4.8</div>
              <div className="flex justify-center mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <div className="text-muted-foreground">Average Rating</div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <div className="text-4xl font-bold mb-2">142</div>
              <div className="text-muted-foreground">Total Reviews</div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <div className="text-4xl font-bold mb-2">92%</div>
              <div className="text-muted-foreground">Positive Feedback</div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <div className="text-4xl font-bold mb-2">85%</div>
              <div className="text-muted-foreground">Response Rate</div>
            </div>
          </div>

          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <img
                      src={review.avatar}
                      alt={review.customer}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="font-semibold">{review.customer}</h3>
                      <div className="flex items-center space-x-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          • {review.date}
                        </span>
                      </div>
                      <p className="mt-2">{review.comment}</p>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Ordered: {review.dish}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      {review.helpful}
                    </Button>
                    <Button variant="ghost" size="sm" className={review.replied ? "text-green-500" : ""}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {review.replied ? "Replied" : "Reply"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}