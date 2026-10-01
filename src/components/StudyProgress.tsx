
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Calendar, Clock, Target } from 'lucide-react';

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
    { subject: 'Physics', progress: 85, color: 'bg-blue-500' },
    { subject: 'Chemistry', progress: 72, color: 'bg-green-500' },
    { subject: 'Mathematics', progress: 91, color: 'bg-purple-500' },
    { subject: 'Biology', progress: 68, color: 'bg-orange-500' },
  ];

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Track Your
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> Progress</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Visualize your learning journey with detailed analytics and insights that help you stay motivated.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Study Hours Chart */}
          <Card className="p-6 bg-white shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-indigo-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">Weekly Study Hours</h3>
              </div>
              <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">
                23.4h this week
              </Badge>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={studyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Line 
                    type="monotone" 
                    dataKey="hours" 
                    stroke="#6366f1" 
                    strokeWidth={3}
                    dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#4f46e5' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Topics Covered Chart */}
          <Card className="p-6 bg-white shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Target className="w-5 h-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">Topics Mastered</h3>
              </div>
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                27 topics this week
              </Badge>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Bar 
                    dataKey="topics" 
                    fill="#a855f7"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Subject Progress */}
        <Card className="p-8 bg-white shadow-lg">
          <div className="flex items-center mb-8">
            <TrendingUp className="w-6 h-6 text-green-600 mr-3" />
            <h3 className="text-2xl font-bold text-gray-900">Subject Mastery</h3>
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
                      strokeWidth="2"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={subject.color.replace('bg-', '').replace('500', '#6366f1')}
                      strokeWidth="2"
                      strokeDasharray={`${subject.progress}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-900">{subject.progress}%</span>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">{subject.subject}</h4>
                <div className={`w-full h-2 ${subject.color.replace('500', '200')} rounded-full`}>
                  <div 
                    className={`h-2 ${subject.color} rounded-full transition-all duration-500`}
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
