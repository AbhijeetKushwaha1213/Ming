import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Clock, Target } from 'lucide-react';

export const StudyProgress = () => {
  const studyData = [
    { day: 'Mon', hours: 2.5, topics: 3 },
    { day: 'Tue', hours: 3.2, topics: 4 },
    { day: 'Wed', hours: 2.8, topics: 3 },
    { day: 'Thu', hours: 4.1, topics: 5 },
    { day: 'Fri', hours: 3.5, topics: 4 },
    { day: 'Sat', hours: 5.2, topics: 6 },
    { day: 'Sun', hours: 2.1, topics: 2 },
  ];

  const subjectProgress = [
    { subject: 'Physics', progress: 85, color: 'bg-emerald-600', stroke: '#165034' },
    { subject: 'Chemistry', progress: 72, color: 'bg-teal-600', stroke: '#0d9488' },
    { subject: 'Mathematics', progress: 91, color: 'bg-[#165034]', stroke: '#165034' },
    { subject: 'Computer Science', progress: 88, color: 'bg-amber-600', stroke: '#d97706' },
  ];

  return (
    <section className="py-20 px-4 bg-background border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-foreground mb-4">
            Track Your <span className="italic font-serif text-primary">Progress</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Visualize your learning journey with detailed cognitive analytics and knowledge tracing insights.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Study Hours Chart */}
          <Card className="p-6 bg-card border border-border shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-primary mr-2" />
                <h3 className="font-serif text-lg font-bold text-foreground">Weekly Study Hours</h3>
              </div>
              <Badge className="bg-secondary text-primary hover:bg-secondary">
                23.4h this week
              </Badge>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={studyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Line 
                    type="monotone" 
                    dataKey="hours" 
                    stroke="#165034" 
                    strokeWidth={2.5}
                    dot={{ fill: '#165034', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#002313' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Topics Covered Chart */}
          <Card className="p-6 bg-card border border-border shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Target className="w-5 h-5 text-primary mr-2" />
                <h3 className="font-serif text-lg font-bold text-foreground">Concepts Mastered</h3>
              </div>
              <Badge className="bg-secondary text-primary hover:bg-secondary">
                27 concepts this week
              </Badge>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Bar 
                    dataKey="topics" 
                    fill="#165034"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Subject Progress */}
        <Card className="p-8 bg-card border border-border shadow-xs">
          <div className="flex items-center mb-8">
            <TrendingUp className="w-6 h-6 text-primary mr-3" />
            <h3 className="font-serif text-2xl font-bold text-foreground">Subject Mastery</h3>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {subjectProgress.map((subject, index) => (
              <div key={index} className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={subject.stroke}
                      strokeWidth="2.5"
                      strokeDasharray={`${subject.progress}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-serif text-xl font-bold text-foreground">{subject.progress}%</span>
                  </div>
                </div>
                <h4 className="font-semibold text-foreground mb-2">{subject.subject}</h4>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${subject.color} rounded-full transition-all duration-500`}
                    style={{ width: `${subject.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
};
