import React, { useState, useEffect } from 'react';
import { Users, Building, Briefcase, Target, TrendingUp, ArrowRight } from 'lucide-react';
import './NetworkAnalysis.css';

interface NetworkAnalysisProps {
  importId?: string;
}

interface BasicInsights {
  totalConnections: number;
  topCompanies: number;
  highValueContacts: number;
  uniqueConnections: number;
}

export const NetworkAnalysis: React.FC<NetworkAnalysisProps> = ({ importId }) => {
  const [insights, setInsights] = useState<BasicInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading insights (in Phase 2, this will be real API call)
    const loadInsights = async () => {
      setIsLoading(true);
      
      // Mock insights for now
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setInsights({
        totalConnections: 2143,
        topCompanies: 127,
        highValueContacts: 89,
        uniqueConnections: 1856
      });
      
      setIsLoading(false);
    };

    loadInsights();
  }, [importId]);

  if (isLoading) {
    return (
      <div className="network-analysis loading">
        <div className="loading-spinner">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p>Analyzing your network...</p>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="network-analysis error">
        <p>Unable to load network analysis.</p>
      </div>
    );
  }

  return (
    <div className="network-analysis">
      <div className="analysis-header">
        <h2>🎉 Network Analysis Complete!</h2>
        <p>Your LinkedIn network has been analyzed and is ready for outreach.</p>
      </div>

      <div className="insights-grid">
        <div className="insight-card">
          <div className="insight-icon">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div className="insight-content">
            <h3>{insights.totalConnections.toLocaleString()}</h3>
            <p>Total Connections</p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon">
            <Building className="h-6 w-6 text-green-600" />
          </div>
          <div className="insight-content">
            <h3>{insights.topCompanies}</h3>
            <p>Target Companies</p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon">
            <Target className="h-6 w-6 text-purple-600" />
          </div>
          <div className="insight-content">
            <h3>{insights.highValueContacts}</h3>
            <p>High-Value Contacts</p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon">
            <TrendingUp className="h-6 w-6 text-orange-600" />
          </div>
          <div className="insight-content">
            <h3>{insights.uniqueConnections.toLocaleString()}</h3>
            <p>Unique Contacts</p>
          </div>
        </div>
      </div>

      <div className="analysis-summary">
        <h3>🚀 Key Insights</h3>
        <div className="summary-points">
          <div className="summary-point">
            <Briefcase className="h-4 w-4" />
            <span><strong>Top Segment:</strong> CTOs and Engineering Leaders</span>
          </div>
          <div className="summary-point">
            <Building className="h-4 w-4" />
            <span><strong>Top Industries:</strong> Technology, SaaS, FinTech</span>
          </div>
          <div className="summary-point">
            <Users className="h-4 w-4" />
            <span><strong>Warm Network:</strong> 37 high-relevance contacts</span>
          </div>
        </div>
      </div>

      <div className="recommended-actions">
        <h3>🎯 Recommended Next Steps</h3>
        <div className="action-grid">
          <button className="primary-button action-button">
            <Target className="h-4 w-4" />
            Generate First Campaign
            <ArrowRight className="h-4 w-4" />
          </button>
          
          <button className="secondary-button action-button">
            <Users className="h-4 w-4" />
            Review Top People
            <ArrowRight className="h-4 w-4" />
          </button>
          
          <button className="secondary-button action-button">
            <Building className="h-4 w-4" />
            Explore Companies
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
