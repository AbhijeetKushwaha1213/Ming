import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  BookOpen,
  Search,
  Plus,
  Check,
  ChevronDown,
  AlertTriangle,
  X,
  Minus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface CuratedSubject {
  name: string;
  code?: string;
  abbreviation?: string;
  tags?: string[];
  department?: string;
  isCustom?: boolean;
}

export interface ChooseSubjectsStepProps {
  learningMode: 'college' | 'exam' | '';
  university?: string;
  college?: string;
  degree?: string;
  course?: string;
  semester?: string | number;
  academicYear?: string;
  examType?: string;
  targetYear?: string;
  selectedSubjects: string[];
  onChange: (subjects: string[]) => void;
}

// -------------------------------------------------------------
// Curated AI Knowledge-Base of University & Competitive Exam Subjects
// -------------------------------------------------------------
export const CONTEXTUAL_SUBJECT_CATALOG: Record<string, Record<number, CuratedSubject[]>> = {
  'btech_cs': {
    1: [
      { name: 'Engineering Mathematics I', code: 'MATH101', abbreviation: 'M1', tags: ['calculus', 'matrices', 'algebra'] },
      { name: 'Engineering Physics', code: 'PHY101', abbreviation: 'PHY', tags: ['optics', 'quantum', 'electromagnetism'] },
      { name: 'Programming for Problem Solving', code: 'CS101', abbreviation: 'PPS', tags: ['c', 'python', 'coding'] },
      { name: 'Basic Electrical & Electronics', code: 'BEEE101', abbreviation: 'BEEE', tags: ['circuits', 'diodes', 'ac dc'] },
      { name: 'Engineering Graphics & CAD', code: 'ME101', abbreviation: 'EG', tags: ['cad', 'drawings', 'projections'] },
    ],
    2: [
      { name: 'Engineering Mathematics II', code: 'MATH102', abbreviation: 'M2', tags: ['differential equations', 'vector calculus'] },
      { name: 'Engineering Chemistry', code: 'CH101', abbreviation: 'CHEM', tags: ['polymers', 'thermodynamics', 'spectroscopy'] },
      { name: 'Object Oriented Programming', code: 'CS102', abbreviation: 'OOP', tags: ['c++', 'java', 'classes', 'inheritance'] },
      { name: 'Digital Electronics', code: 'ECE102', abbreviation: 'DE', tags: ['logic gates', 'flip flops', 'counters'] },
      { name: 'Environmental Sciences', code: 'EVS102', abbreviation: 'EVS', tags: ['ecology', 'sustainability'] },
    ],
    3: [
      { name: 'Data Structures & Algorithms', code: 'CS301', abbreviation: 'DSA', tags: ['trees', 'graphs', 'sorting', 'stacks', 'queues'] },
      { name: 'Computer Organization & Architecture', code: 'CS302', abbreviation: 'COA', tags: ['cpu', 'registers', 'cache', 'pipelining'] },
      { name: 'Discrete Mathematics', code: 'CS303', abbreviation: 'DM', tags: ['graph theory', 'combinatorics', 'relations', 'logic'] },
      { name: 'Digital Logic Design', code: 'CS304', abbreviation: 'DLD', tags: ['boolean algebra', 'k-maps', 'multiplexers'] },
      { name: 'Object Oriented Software Development', code: 'CS305', abbreviation: 'OOSD', tags: ['design patterns', 'uml', 'solid'] },
    ],
    4: [
      { name: 'Operating Systems', code: 'CS401', abbreviation: 'OS', tags: ['processes', 'threads', 'deadlocks', 'memory management', 'scheduling'] },
      { name: 'Database Management Systems', code: 'CS402', abbreviation: 'DBMS', tags: ['sql', 'normalization', 'transactions', 'acid', 'indexing'] },
      { name: 'Theory of Computation', code: 'CS403', abbreviation: 'TOC', tags: ['automata', 'dfa', 'nfa', 'turing machines', 'grammar'] },
      { name: 'Computer Networks', code: 'CS404', abbreviation: 'CN', tags: ['tcp/ip', 'osi model', 'routing', 'ethernet', 'http'] },
      { name: 'Design & Analysis of Algorithms', code: 'CS405', abbreviation: 'DAA', tags: ['asymptotics', 'greedy', 'dynamic programming', 'np-complete'] },
    ],
    5: [
      { name: 'Compiler Design', code: 'CS501', abbreviation: 'CD', tags: ['lexical analysis', 'parsing', 'code generation', 'syntax trees'] },
      { name: 'Software Engineering', code: 'CS502', abbreviation: 'SE', tags: ['agile', 'scrum', 'testing', 'sdlc', 'devops'] },
      { name: 'Artificial Intelligence', code: 'CS503', abbreviation: 'AI', tags: ['heuristic search', 'knowledge representation', 'logic', 'agents'] },
      { name: 'Microprocessors & Microcontrollers', code: 'CS504', abbreviation: 'MPMC', tags: ['8086', 'assembly', 'arm', 'interrupts'] },
      { name: 'Full-Stack Web Development', code: 'CS505', abbreviation: 'FSW', tags: ['react', 'node', 'express', 'rest api', 'typescript'] },
    ],
    6: [
      { name: 'Machine Learning', code: 'CS601', abbreviation: 'ML', tags: ['supervised', 'unsupervised', 'regression', 'svm', 'neural networks'] },
      { name: 'Cryptography & Cyber Security', code: 'CS602', abbreviation: 'CNS', tags: ['rsa', 'aes', 'encryption', 'hash', 'security'] },
      { name: 'Cloud Computing & Distributed Systems', code: 'CS603', abbreviation: 'CC', tags: ['aws', 'microservices', 'docker', 'kubernetes'] },
      { name: 'Big Data Analytics', code: 'CS604', abbreviation: 'BDA', tags: ['spark', 'hadoop', 'mapreduce', 'data pipelines'] },
      { name: 'Mobile Application Development', code: 'CS605', abbreviation: 'MAD', tags: ['flutter', 'react native', 'android', 'ios'] },
    ],
    7: [
      { name: 'Deep Learning & Neural Networks', code: 'CS701', abbreviation: 'DL', tags: ['cnn', 'rnn', 'transformers', 'pytorch'] },
      { name: 'Natural Language Processing', code: 'CS702', abbreviation: 'NLP', tags: ['llms', 'tokenization', 'embeddings', 'bert'] },
      { name: 'Internet of Things (IoT)', code: 'CS703', abbreviation: 'IOT', tags: ['sensors', 'arduino', 'mqtt', 'edge computing'] },
      { name: 'DevOps & Site Reliability', code: 'CS704', abbreviation: 'DEVOPS', tags: ['ci/cd', 'terraform', 'monitoring', 'gitops'] },
    ],
    8: [
      { name: 'Major Capstone Project', code: 'CS801', abbreviation: 'CAP', tags: ['project', 'implementation', 'dissertation'] },
      { name: 'Quantum Computing Fundamentals', code: 'CS802', abbreviation: 'QC', tags: ['qubits', 'circuits', 'algorithms'] },
      { name: 'High Performance Computing', code: 'CS803', abbreviation: 'HPC', tags: ['mpi', 'openmp', 'parallel computing'] },
    ],
  },
  'btech_me': {
    1: [
      { name: 'Engineering Thermodynamics', code: 'ME201', abbreviation: 'THERMO', tags: ['laws of thermo', 'cycles', 'entropy'] },
      { name: 'Fluid Mechanics', code: 'ME202', abbreviation: 'FM', tags: ['viscosity', 'bernoulli', 'flow'] },
      { name: 'Strength of Materials', code: 'ME203', abbreviation: 'SOM', tags: ['stress', 'strain', 'beams', 'torsion'] },
      { name: 'Material Science & Metallurgy', code: 'ME204', abbreviation: 'MSM', tags: ['crystal structures', 'alloys', 'heat treatment'] },
      { name: 'Kinematics of Machinery', code: 'ME301', abbreviation: 'KOM', tags: ['mechanisms', 'gears', 'cams'] },
      { name: 'Manufacturing Processes', code: 'ME302', abbreviation: 'MP', tags: ['casting', 'welding', 'machining'] },
      { name: 'Heat and Mass Transfer', code: 'ME401', abbreviation: 'HMT', tags: ['conduction', 'convection', 'radiation'] },
      { name: 'Design of Machine Elements', code: 'ME402', abbreviation: 'DME', tags: ['shafts', 'bearings', 'fasteners'] },
    ],
  },
  'btech_ee': {
    1: [
      { name: 'Network Analysis & Circuit Theory', code: 'EE201', abbreviation: 'NET', tags: ['kirchhoff', 'thevenin', 'rlc'] },
      { name: 'Electrical Machines I & II', code: 'EE202', abbreviation: 'EM', tags: ['transformers', 'dc motors', 'induction'] },
      { name: 'Power Systems Analysis', code: 'EE301', abbreviation: 'PSA', tags: ['transmission', 'faults', 'grid'] },
      { name: 'Control Systems Engineering', code: 'EE302', abbreviation: 'CS', tags: ['bode plots', 'pid', 'nyquist', 'stability'] },
      { name: 'Power Electronics', code: 'EE401', abbreviation: 'PE', tags: ['inverters', 'rectifiers', 'choppers'] },
      { name: 'Analog & Digital Signal Processing', code: 'EE402', abbreviation: 'DSP', tags: ['fft', 'z-transform', 'filters'] },
      { name: 'Electromagnetic Field Theory', code: 'EE403', abbreviation: 'EMFT', tags: ['maxwell equations', 'waves'] },
    ],
  },
  'btech_ce': {
    1: [
      { name: 'Structural Analysis', code: 'CE201', abbreviation: 'SA', tags: ['trusses', 'moments', 'deflection'] },
      { name: 'Geotechnical Engineering & Soil Mechanics', code: 'CE202', abbreviation: 'GEO', tags: ['soil', 'foundations', 'permeability'] },
      { name: 'Surveying & Geomatics', code: 'CE203', abbreviation: 'SURV', tags: ['total station', 'theodolite', 'gis'] },
      { name: 'Concrete Technology', code: 'CE301', abbreviation: 'CT', tags: ['cement', 'admixtures', 'mix design'] },
      { name: 'Design of RCC Structures', code: 'CE401', abbreviation: 'RCC', tags: ['beams', 'columns', 'slabs'] },
      { name: 'Transportation & Highway Engineering', code: 'CE402', abbreviation: 'THE', tags: ['pavement', 'traffic', 'geometry'] },
      { name: 'Environmental Engineering', code: 'CE501', abbreviation: 'EE', tags: ['water treatment', 'air pollution', 'sewage'] },
    ],
  },
  'bsc_bio': {
    1: [
      { name: 'Cell Biology & Biomolecules', code: 'BIO101', abbreviation: 'CB', tags: ['organelles', 'membranes', 'proteins', 'dna'] },
      { name: 'Genetics & Molecular Biology', code: 'BIO201', abbreviation: 'GEN', tags: ['inheritance', 'transcription', 'translation'] },
      { name: 'Microbiology & Immunology', code: 'BIO202', abbreviation: 'MICRO', tags: ['bacteria', 'viruses', 'antibodies'] },
      { name: 'Human Physiology & Endocrinology', code: 'BIO301', abbreviation: 'HP', tags: ['circulatory', 'nervous', 'hormones'] },
      { name: 'Plant Physiology & Anatomy', code: 'BIO302', abbreviation: 'PP', tags: ['photosynthesis', 'respiration', 'xylem'] },
      { name: 'Ecology & Evolutionary Biology', code: 'BIO401', abbreviation: 'ECO', tags: ['natural selection', 'ecosystems', 'biodiversity'] },
    ],
  },
  'bsc_phy': {
    1: [
      { name: 'Classical Mechanics & Relativity', code: 'PHY201', abbreviation: 'CM', tags: ['lagrangian', 'hamiltonian', 'newton'] },
      { name: 'Electromagnetism & Wave Theory', code: 'PHY202', abbreviation: 'EM', tags: ['maxwell', 'electrostatics', 'magnetostatics'] },
      { name: 'Quantum Mechanics', code: 'PHY301', abbreviation: 'QM', tags: ['schrodinger', 'operators', 'wavefunction'] },
      { name: 'Thermal & Statistical Physics', code: 'PHY302', abbreviation: 'STAT', tags: ['ensembles', 'partition function', 'entropy'] },
      { name: 'Solid State Physics & Materials', code: 'PHY401', abbreviation: 'SSP', tags: ['crystal lattices', 'superconductivity', 'semiconductors'] },
      { name: 'Nuclear & Particle Physics', code: 'PHY501', abbreviation: 'NP', tags: ['radioactivity', 'quarks', 'fission fusion'] },
    ],
  },
  'bsc_chem': {
    1: [
      { name: 'Organic Reaction Mechanisms', code: 'CH201', abbreviation: 'ORG', tags: ['substitution', 'elimination', 'aromatics', 'synthesis'] },
      { name: 'Inorganic & Coordination Chemistry', code: 'CH202', abbreviation: 'INORG', tags: ['crystal field', 'ligands', 'transition metals'] },
      { name: 'Physical Chemistry & Chemical Kinetics', code: 'CH301', abbreviation: 'PHYS', tags: ['rates', 'catalysis', 'electrochemistry'] },
      { name: 'Spectroscopy & Analytical Methods', code: 'CH302', abbreviation: 'SPEC', tags: ['nmr', 'ir', 'uv-vis', 'mass spec'] },
      { name: 'Quantum Chemistry & Thermodynamics', code: 'CH401', abbreviation: 'QC', tags: ['orbitals', 'free energy', 'entropy'] },
    ],
  },
  'ba_econ': {
    1: [
      { name: 'Microeconomics Theory', code: 'ECON101', abbreviation: 'MICRO', tags: ['consumer theory', 'monopoly', 'game theory'] },
      { name: 'Macroeconomics Principles', code: 'ECON102', abbreviation: 'MACRO', tags: ['gdp', 'inflation', 'fiscal monetary policy'] },
      { name: 'Econometrics & Statistical Methods', code: 'ECON201', abbreviation: 'METRICS', tags: ['regression', 'hypothesis testing', 'ols'] },
      { name: 'International Trade & Finance', code: 'ECON202', abbreviation: 'TRADE', tags: ['tariffs', 'exchange rates', 'bop'] },
      { name: 'Public Finance & Policy', code: 'ECON301', abbreviation: 'PUB', tags: ['taxation', 'public goods', 'subsidies'] },
      { name: 'Money, Banking & Financial Markets', code: 'ECON302', abbreviation: 'BANK', tags: ['central banking', 'interest rates', 'liquidity'] },
    ],
  },
  'bba_bcom': {
    1: [
      { name: 'Financial Accounting & Analysis', code: 'ACC101', abbreviation: 'ACC', tags: ['balance sheet', 'cash flow', 'p&l', 'ledger'] },
      { name: 'Principles of Marketing Management', code: 'MKT101', abbreviation: 'MKT', tags: ['branding', '4ps', 'consumer behavior'] },
      { name: 'Business Law & Corporate Governance', code: 'BLAW201', abbreviation: 'BLAW', tags: ['contracts', 'companies act', 'ethics'] },
      { name: 'Corporate Finance & Valuation', code: 'FIN201', abbreviation: 'FIN', tags: ['npv', 'irr', 'capital structure', 'wacc'] },
      { name: 'Human Resource Management', code: 'HRM201', abbreviation: 'HRM', tags: ['recruitment', 'performance', 'payroll'] },
      { name: 'Business Statistics & Operations Research', code: 'STAT201', abbreviation: 'STATS', tags: ['linear programming', 'probability'] },
      { name: 'Income Tax & Corporate Taxation (GST)', code: 'TAX301', abbreviation: 'TAX', tags: ['deductions', 'filing', 'gst'] },
    ],
  },
};

// -------------------------------------------------------------
// Curated Competitive Exam Catalogs
// -------------------------------------------------------------
export const EXAM_SUBJECT_CATALOG: Record<string, CuratedSubject[]> = {
  'jee': [
    { name: 'Physics - Mechanics & Dynamics', code: 'JEE-PHY1', abbreviation: 'PHY-MEC', tags: ['kinematics', 'work energy', 'rotational motion', 'gravitation'] },
    { name: 'Physics - Electromagnetism & Modern Physics', code: 'JEE-PHY2', abbreviation: 'PHY-EM', tags: ['electrostatics', 'current electricity', 'magnetism', 'nuclei'] },
    { name: 'Physics - Optics, Waves & Thermodynamics', code: 'JEE-PHY3', abbreviation: 'PHY-OPT', tags: ['ray optics', 'wave optics', 'heat', 'shm'] },
    { name: 'Chemistry - Physical Chemistry', code: 'JEE-CH1', abbreviation: 'CH-PHYS', tags: ['mole concept', 'equilibrium', 'kinetics', 'thermodynamics'] },
    { name: 'Chemistry - Organic Chemistry', code: 'JEE-CH2', abbreviation: 'CH-ORG', tags: ['hydrocarbons', 'aldehydes', 'amines', 'reaction mechanisms'] },
    { name: 'Chemistry - Inorganic Chemistry', code: 'JEE-CH3', abbreviation: 'CH-INORG', tags: ['periodic table', 'chemical bonding', 'p-block', 'coordination'] },
    { name: 'Mathematics - Calculus (Differential & Integral)', code: 'JEE-M1', abbreviation: 'MATH-CALC', tags: ['limits', 'derivatives', 'integrals', 'differential equations'] },
    { name: 'Mathematics - Algebra & Complex Numbers', code: 'JEE-M2', abbreviation: 'MATH-ALG', tags: ['matrices', 'determinants', 'quadratic', 'sequences'] },
    { name: 'Mathematics - Coordinate Geometry & Vectors', code: 'JEE-M3', abbreviation: 'MATH-GEOM', tags: ['circles', 'conics', 'straight lines', '3d geometry'] },
  ],
  'neet': [
    { name: 'Biology - Human Physiology & Anatomy', code: 'NEET-B1', abbreviation: 'BIO-PHYS', tags: ['digestion', 'neural', 'circulation', 'excretion', 'respiration'] },
    { name: 'Biology - Genetics, Evolution & Biotech', code: 'NEET-B2', abbreviation: 'BIO-GEN', tags: ['mendel', 'molecular basis of inheritance', 'genetic engineering'] },
    { name: 'Biology - Cell Biology & Cell Division', code: 'NEET-B3', abbreviation: 'BIO-CELL', tags: ['mitosis', 'meiosis', 'biomolecules', 'organelles'] },
    { name: 'Biology - Botany & Plant Physiology', code: 'NEET-B4', abbreviation: 'BIO-PLANT', tags: ['photosynthesis', 'transpiration', 'mineral nutrition', 'morphology'] },
    { name: 'Biology - Ecology, Environment & Diversity', code: 'NEET-B5', abbreviation: 'BIO-ECO', tags: ['ecosystems', 'taxonomical aids', 'conservation', 'biodiversity'] },
    { name: 'Chemistry - Organic Chemistry (High Yield)', code: 'NEET-CH1', abbreviation: 'CH-ORG', tags: ['biomolecules', 'polymers', 'named reactions', 'isomers'] },
    { name: 'Chemistry - Inorganic Chemistry (NCERT High Yield)', code: 'NEET-CH2', abbreviation: 'CH-INORG', tags: ['coordination compounds', 's-block', 'p-block', 'd-block'] },
    { name: 'Chemistry - Physical Chemistry & Solutions', code: 'NEET-CH3', abbreviation: 'CH-PHYS', tags: ['solutions', 'electrochemistry', 'solid state', 'equilibrium'] },
    { name: 'Physics - High Yield NEET Core', code: 'NEET-PHY', abbreviation: 'PHY-NEET', tags: ['mechanics', 'optics', 'current electricity', 'semiconductors'] },
  ],
  'upsc': [
    { name: 'Indian Polity, Governance & Constitution', code: 'GS-II-A', abbreviation: 'POLITY', tags: ['preamble', 'fundamental rights', 'judiciary', 'parliament'] },
    { name: 'Modern Indian History & National Movement', code: 'GS-I-A', abbreviation: 'HIST', tags: ['1857 revolt', 'freedom struggle', 'gandhian era', 'viceroys'] },
    { name: 'Geography of India & Physical Geography', code: 'GS-I-B', abbreviation: 'GEO', tags: ['monsoons', 'plate tectonics', 'rivers', 'agriculture', 'climate'] },
    { name: 'Indian Economy & Sustainable Development', code: 'GS-III-A', abbreviation: 'ECON', tags: ['budget', 'banking', 'inflation', 'poverty', 'infrastructure'] },
    { name: 'Environment, Ecology & Climate Governance', code: 'GS-III-B', abbreviation: 'ENV', tags: ['biodiversity hotspots', 'unfccc', 'wildlife protection act'] },
    { name: 'Science & Emerging Technologies', code: 'GS-III-C', abbreviation: 'S&T', tags: ['space', 'biotechnology', 'ai', 'defence tech', 'nanotechnology'] },
    { name: 'Ethics, Integrity & Case Studies', code: 'GS-IV', abbreviation: 'ETHICS', tags: ['attitude', 'emotional intelligence', 'moral thinkers', 'case studies'] },
    { name: 'International Relations & Strategic Affairs', code: 'GS-II-B', abbreviation: 'IR', tags: ['neighbourhood policy', 'g20', 'un', 'bilateral treaties'] },
    { name: 'CSAT (Quantitative Aptitude & Reading)', code: 'CSAT', abbreviation: 'CSAT', tags: ['comprehension', 'reasoning', 'percentages', 'number system'] },
  ],
  'gate': [
    { name: 'Engineering Mathematics & Probability', code: 'GATE-M', abbreviation: 'ENG-MATH', tags: ['linear algebra', 'calculus', 'probability', 'statistics'] },
    { name: 'Discrete Mathematics & Combinatorics', code: 'GATE-DM', abbreviation: 'DM', tags: ['propositional logic', 'graphs', 'sets', 'recurrence relations'] },
    { name: 'Data Structures & Algorithms', code: 'GATE-DSA', abbreviation: 'DSA', tags: ['time complexity', 'trees', 'dynamic programming', 'graphs'] },
    { name: 'Computer Organization & Architecture', code: 'GATE-COA', abbreviation: 'COA', tags: ['pipeline hazards', 'cache mapping', 'instruction sets'] },
    { name: 'Theory of Computation & Automata', code: 'GATE-TOC', abbreviation: 'TOC', tags: ['decidability', 'regular expressions', 'pumping lemma'] },
    { name: 'Compiler Design', code: 'GATE-CD', abbreviation: 'CD', tags: ['syntax directed translation', 'lr parsing', 'liveness'] },
    { name: 'Operating Systems & Concurrency', code: 'GATE-OS', abbreviation: 'OS', tags: ['semaphores', 'paging', 'virtual memory', 'disk scheduling'] },
    { name: 'Database Management Systems', code: 'GATE-DBMS', abbreviation: 'DBMS', tags: ['b+ trees', 'normalization', 'serializability', 'relational algebra'] },
    { name: 'Computer Networks & Protocols', code: 'GATE-CN', abbreviation: 'CN', tags: ['sliding window', 'ipv4', 'tcp congestion', 'routing algorithms'] },
  ],
  'cat': [
    { name: 'Quantitative Aptitude (Arithmetic & Modern Math)', code: 'CAT-QA', abbreviation: 'QA', tags: ['percentages', 'geometry', 'algebra', 'permutations'] },
    { name: 'Data Interpretation & Graphs', code: 'CAT-DI', abbreviation: 'DI', tags: ['bar charts', 'tables', 'caselets', 'radar graphs'] },
    { name: 'Logical Reasoning & Arrangements', code: 'CAT-LR', abbreviation: 'LR', tags: ['seating arrangement', 'blood relations', 'matrix puzzles'] },
    { name: 'Verbal Ability & Reading Comprehension', code: 'CAT-VARC', abbreviation: 'VARC', tags: ['passages', 'parajumbles', 'summary', 'sentence completion'] },
  ],
  'clat': [
    { name: 'Legal Reasoning & Constitutional Law', code: 'CLAT-LR', abbreviation: 'LEGAL', tags: ['torts', 'contracts', 'criminal law', 'constitutional law'] },
    { name: 'Current Affairs & Contemporary GK', code: 'CLAT-GK', abbreviation: 'GK', tags: ['international summits', 'supreme court rulings', 'treaties'] },
    { name: 'Logical Reasoning & Critical Thinking', code: 'CLAT-LOGIC', abbreviation: 'LOGIC', tags: ['syllogisms', 'arguments', 'deductive logic'] },
    { name: 'English Language & Reading Comprehension', code: 'CLAT-ENG', abbreviation: 'ENG', tags: ['vocabulary', 'contextual reading', 'grammar'] },
    { name: 'Quantitative Techniques', code: 'CLAT-QT', abbreviation: 'QT', tags: ['data graphs', 'ratios', 'percentages'] },
  ],
};

// Global fallback general subjects
export const GENERAL_SUBJECT_CATALOG: CuratedSubject[] = [
  { name: 'Artificial Intelligence & Machine Learning', code: 'AI101', abbreviation: 'AI/ML', tags: ['ai', 'data science', 'deep learning'] },
  { name: 'Cyber Security & Ethical Hacking', code: 'SEC101', abbreviation: 'CYBER', tags: ['security', 'network security', 'cryptography'] },
  { name: 'Cloud Computing Architecture', code: 'CLOUD101', abbreviation: 'CLOUD', tags: ['aws', 'azure', 'devops', 'kubernetes'] },
  { name: 'Data Analytics & Visualization', code: 'DATA101', abbreviation: 'ANALYTICS', tags: ['power bi', 'tableau', 'sql', 'python'] },
  { name: 'Full-Stack Software Engineering', code: 'SE101', abbreviation: 'FSD', tags: ['react', 'next.js', 'apis', 'databases'] },
  { name: 'General Aptitude & Logical Reasoning', code: 'GEN101', abbreviation: 'APT', tags: ['math', 'logic', 'problem solving'] },
  { name: 'Communication & Technical Writing', code: 'COMM101', abbreviation: 'COMM', tags: ['english', 'writing', 'presentation'] },
  { name: 'Project Management & Agile', code: 'MGT101', abbreviation: 'AGILE', tags: ['scrum', 'kanban', 'jira', 'leadership'] },
];

/**
 * Returns contextually relevant subjects based on user's degree, branch, semester, academic year, college, or target exam.
 */
export function getContextualSubjects(context: {
  learningMode: 'college' | 'exam' | '';
  course?: string;
  degree?: string;
  semester?: string | number;
  academicYear?: string;
  college?: string;
  university?: string;
  examType?: string;
  targetYear?: string;
}): { recommended: CuratedSubject[]; all: CuratedSubject[] } {
  const { learningMode, course, degree, semester, academicYear, examType } = context;
  
  // Resolve semester number: direct, or derived from academic year
  let semNumber = semester ? parseInt(String(semester), 10) || 1 : 1;
  if (!semester && academicYear) {
    const yr = parseInt(String(academicYear).replace(/\D/g, ''), 10) || 1;
    semNumber = Math.max(1, (yr * 2) - 1);
  }

  let recommendedList: CuratedSubject[] = [];
  let relatedList: CuratedSubject[] = [];

  if (learningMode === 'exam') {
    const examKey = (examType || '').toLowerCase();
    let matchedExamKey = 'jee';
    if (examKey.includes('neet') || examKey.includes('medical')) matchedExamKey = 'neet';
    else if (examKey.includes('upsc') || examKey.includes('civil')) matchedExamKey = 'upsc';
    else if (examKey.includes('gate') || examKey.includes('graduate')) matchedExamKey = 'gate';
    else if (examKey.includes('cat') || examKey.includes('mba')) matchedExamKey = 'cat';
    else if (examKey.includes('clat') || examKey.includes('law')) matchedExamKey = 'clat';
    else if (examKey.includes('cuet') || examKey.includes('bank') || examKey.includes('ssc')) matchedExamKey = 'cat';

    recommendedList = EXAM_SUBJECT_CATALOG[matchedExamKey] || EXAM_SUBJECT_CATALOG['jee'];
    // Merge other exam catalogs for global search
    Object.keys(EXAM_SUBJECT_CATALOG).forEach((k) => {
      if (k !== matchedExamKey) {
        relatedList.push(...EXAM_SUBJECT_CATALOG[k]);
      }
    });
  } else {
    // College mode
    const searchString = `${degree || ''} ${course || ''}`.toLowerCase();
    let matchedBranchKey = 'btech_cs';
    if (searchString.includes('mechanical')) matchedBranchKey = 'btech_me';
    else if (searchString.includes('electrical') || searchString.includes('electronics') || searchString.includes('ece') || searchString.includes('eee')) matchedBranchKey = 'btech_ee';
    else if (searchString.includes('civil')) matchedBranchKey = 'btech_ce';
    else if (searchString.includes('bio')) matchedBranchKey = 'bsc_bio';
    else if (searchString.includes('physic')) matchedBranchKey = 'bsc_phy';
    else if (searchString.includes('chemi')) matchedBranchKey = 'bsc_chem';
    else if (searchString.includes('econ')) matchedBranchKey = 'ba_econ';
    else if (searchString.includes('bba') || searchString.includes('bcom') || searchString.includes('commerce') || searchString.includes('business')) matchedBranchKey = 'bba_bcom';

    const branchCatalog = CONTEXTUAL_SUBJECT_CATALOG[matchedBranchKey] || CONTEXTUAL_SUBJECT_CATALOG['btech_cs'];

    // 1. Exact semester match is the top recommended
    if (branchCatalog[semNumber]) {
      recommendedList = [...branchCatalog[semNumber]];
    } else if (branchCatalog[1]) {
      recommendedList = [...branchCatalog[1]];
    }

    // 2. Add other semesters of same branch as related
    Object.keys(branchCatalog).forEach((sKey) => {
      const s = parseInt(sKey, 10);
      if (s !== semNumber) {
        relatedList.push(...branchCatalog[s]);
      }
    });

    // 3. Add other branch core courses as general
    Object.keys(CONTEXTUAL_SUBJECT_CATALOG).forEach((bKey) => {
      if (bKey !== matchedBranchKey) {
        const otherBranch = CONTEXTUAL_SUBJECT_CATALOG[bKey];
        if (otherBranch[1]) relatedList.push(...otherBranch[1].slice(0, 3));
      }
    });
  }

  // Deduplicate all list
  const seenNames = new Set<string>();
  const combinedAll: CuratedSubject[] = [];

  [...recommendedList, ...relatedList, ...GENERAL_SUBJECT_CATALOG].forEach((sub) => {
    if (!seenNames.has(sub.name.toLowerCase())) {
      seenNames.add(sub.name.toLowerCase());
      combinedAll.push(sub);
    }
  });

  return {
    recommended: recommendedList,
    all: combinedAll,
  };
}

export const ChooseSubjectsStep: React.FC<ChooseSubjectsStepProps> = ({
  learningMode,
  university,
  college,
  degree,
  course,
  semester,
  academicYear,
  examType,
  targetYear,
  selectedSubjects,
  onChange,
}) => {
  const { toast } = useToast();

  // Number of subject slots (default to 6 or selected length)
  const initialCount = Math.max(selectedSubjects.length, 6);
  const [subjectCount, setSubjectCount] = useState<number>(initialCount);

  // Array of selected subject strings of length `subjectCount`
  const [slots, setSlots] = useState<string[]>(() => {
    const arr = new Array(initialCount).fill('');
    selectedSubjects.forEach((sub, i) => {
      if (i < initialCount) arr[i] = sub;
    });
    return arr;
  });

  // Keep parent in sync whenever slots change
  useEffect(() => {
    const filtered = slots.filter((s) => s && s.trim().length > 0);
    onChange(filtered);
  }, [slots]);

  // Contextual subjects database
  const { recommended, all } = useMemo(() => {
    return getContextualSubjects({
      learningMode,
      course,
      degree,
      semester,
      academicYear,
      college,
      university,
      examType,
      targetYear,
    });
  }, [learningMode, course, degree, semester, academicYear, college, university, examType, targetYear]);

  // Custom added subjects
  const [customSubjects, setCustomSubjects] = useState<CuratedSubject[]>([]);

  // Search state for popovers: slotIndex -> searchQuery
  const [activeSlotPopover, setActiveSlotPopover] = useState<number | null>(null);
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});

  // Inline custom subject creator form state
  const [customFormSlot, setCustomFormSlot] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');

  // Safeguard prompt when reducing slots
  const [pendingReduceCount, setPendingReduceCount] = useState<number | null>(null);

  // Handle changing total subject count
  const handleRequestCountChange = (newCount: number) => {
    if (newCount < 1 || newCount > 20) return;

    if (newCount < subjectCount) {
      // Check if any slot being removed has a value
      const slotsBeingRemoved = slots.slice(newCount);
      const hasSelectedSubjects = slotsBeingRemoved.some((s) => s && s.trim().length > 0);

      if (hasSelectedSubjects) {
        // Trigger safeguard prompt
        setPendingReduceCount(newCount);
        return;
      }
    }

    // Direct apply if increasing or no data lost
    applyCountChange(newCount);
  };

  const applyCountChange = (newCount: number) => {
    setSubjectCount(newCount);
    setSlots((prev) => {
      if (newCount > prev.length) {
        const added = new Array(newCount - prev.length).fill('');
        return [...prev, ...added];
      } else {
        return prev.slice(0, newCount);
      }
    });
    setPendingReduceCount(null);
  };

  // Select subject for slot
  const handleSelectSubject = (slotIndex: number, subjectName: string) => {
    // Check for duplicate
    const isAlreadySelected = slots.some((s, idx) => idx !== slotIndex && s === subjectName);
    if (isAlreadySelected) {
      toast({
        title: 'Subject already selected',
        description: `"${subjectName}" is already chosen in another slot.`,
        variant: 'destructive',
      });
      return;
    }

    setSlots((prev) => {
      const copy = [...prev];
      copy[slotIndex] = subjectName;
      return copy;
    });

    setActiveSlotPopover(null);
    setSearchQueries((prev) => ({ ...prev, [slotIndex]: '' }));
    setCustomFormSlot(null);
  };

  // Clear slot
  const handleClearSlot = (slotIndex: number) => {
    setSlots((prev) => {
      const copy = [...prev];
      copy[slotIndex] = '';
      return copy;
    });
  };

  // Add custom subject
  const handleAddCustomSubject = (slotIndex: number) => {
    const trimmedName = customName.trim();
    if (!trimmedName) {
      toast({
        title: 'Subject Name Required',
        description: 'Please enter a name for your custom subject.',
        variant: 'destructive',
      });
      return;
    }

    // Check duplicate
    if (slots.some((s, idx) => idx !== slotIndex && s.toLowerCase() === trimmedName.toLowerCase())) {
      toast({
        title: 'Subject already selected',
        description: `"${trimmedName}" is already chosen in another slot.`,
        variant: 'destructive',
      });
      return;
    }

    const newCustom: CuratedSubject = {
      name: trimmedName,
      isCustom: true,
      tags: ['custom'],
    };

    setCustomSubjects((prev) => [newCustom, ...prev]);
    handleSelectSubject(slotIndex, trimmedName);

    setCustomName('');
    setCustomFormSlot(null);
    toast({
      title: 'Custom Subject Added! ✅',
      description: `Added "${trimmedName}" to your curriculum.`,
    });
  };

  // Filtering subjects for a specific slot
  const getFilteredSubjects = (slotIndex: number) => {
    const query = (searchQueries[slotIndex] || '').toLowerCase().trim();
    const currentSelectedInOtherSlots = new Set(
      slots.filter((s, idx) => idx !== slotIndex && s)
    );

    const mergedList = [...customSubjects, ...all];

    if (!query) {
      const seen = new Set<string>();
      const combined: CuratedSubject[] = [];
      [...customSubjects, ...recommended, ...all].forEach((sub) => {
        const key = sub.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(sub);
        }
      });
      return {
        subjects: combined,
        currentSelectedInOtherSlots,
      };
    }

    const matches = mergedList.filter((sub) => {
      const nameMatch = sub.name.toLowerCase().includes(query);
      const tagMatch = sub.tags ? sub.tags.some((t) => t.toLowerCase().includes(query)) : false;
      return nameMatch || tagMatch;
    });

    return {
      subjects: matches,
      currentSelectedInOtherSlots,
    };
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Step Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-tr from-[#063B2A] to-[#20B486] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/15 ring-4 ring-emerald-500/10">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Choose Your Subjects
        </h2>
      </div>

      {/* 1. Subject Count Control Section */}
      <Card className="p-5 border border-border/80 bg-muted/30 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Label className="text-base font-bold text-foreground block">
              How many subjects are you studying?
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose between 1 and 20 subjects. Typically 5–6 per semester.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Quick selector buttons */}
            <div className="hidden md:flex items-center gap-1.5">
              {[4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleRequestCountChange(n)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    subjectCount === n
                      ? 'bg-[#063B2A] text-white shadow-sm scale-105'
                      : 'bg-background hover:bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Stepper with direct number input */}
            <div className="flex items-center bg-background border border-border rounded-xl p-1 shadow-sm">
              <button
                type="button"
                onClick={() => handleRequestCountChange(subjectCount - 1)}
                disabled={subjectCount <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Decrease subject count"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                type="number"
                min={1}
                max={20}
                value={subjectCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    handleRequestCountChange(Math.max(1, Math.min(20, val)));
                  }
                }}
                className="w-12 text-center text-base font-bold text-foreground bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[#20B486] rounded"
                aria-label="Subject count input"
              />

              <button
                type="button"
                onClick={() => handleRequestCountChange(subjectCount + 1)}
                disabled={subjectCount >= 20}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label="Increase subject count"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Safeguard Reduction Confirmation Notice */}
        {pendingReduceCount !== null && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs sm:text-sm font-medium">
                Reducing from {subjectCount} to {pendingReduceCount} will remove previously selected subjects in slots {pendingReduceCount + 1} to {subjectCount}. Proceed?
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPendingReduceCount(null)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => applyCountChange(pendingReduceCount)}
                className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white"
              >
                Confirm & Remove
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 2. Dynamically Rendered Subject Slots */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold text-foreground uppercase tracking-wider text-[11px]">
            Curriculum Slots ({slots.filter(Boolean).length} of {subjectCount} Selected)
          </Label>
          <span className="text-xs text-muted-foreground">
            {slots.filter(Boolean).length === subjectCount ? (
              <span className="text-[#20B486] font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> All Slots Filled
              </span>
            ) : (
              `${subjectCount - slots.filter(Boolean).length} remaining to choose`
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slots.map((selectedSubject, slotIndex) => {
            const isFilled = Boolean(selectedSubject);
            const { subjects: filteredList, currentSelectedInOtherSlots } = getFilteredSubjects(slotIndex);
            const isPopoverOpen = activeSlotPopover === slotIndex;

            return (
              <Card
                key={slotIndex}
                className={`p-4 transition-all duration-200 border ${
                  isFilled
                    ? 'border-[#20B486]/50 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm'
                    : 'border-dashed border-border hover:border-foreground/30 bg-card'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[11px] font-mono">
                      {slotIndex + 1}
                    </span>
                    Subject {slotIndex + 1}
                  </span>

                  {isFilled && (
                    <button
                      type="button"
                      onClick={() => handleClearSlot(slotIndex)}
                      className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                      title="Clear selection"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Clear</span>
                    </button>
                  )}
                </div>

                {/* Combobox Dropdown Trigger */}
                <Popover
                  open={isPopoverOpen}
                  onOpenChange={(open) => {
                    setActiveSlotPopover(open ? slotIndex : null);
                    if (!open) setCustomFormSlot(null);
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all text-sm font-medium ${
                        isFilled
                          ? 'bg-background text-foreground border-emerald-300 dark:border-emerald-800 font-semibold'
                          : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
                      }`}
                    >
                      <span className="truncate pr-2">
                        {isFilled ? selectedSubject : 'Search or select a subject'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </PopoverTrigger>

                  <PopoverContent
                    className="w-[340px] sm:w-[380px] p-0 shadow-2xl rounded-2xl border border-border"
                    align="start"
                  >
                    {/* Top Search Input */}
                    <div className="p-3 border-b border-border bg-muted/40">
                      <div className="relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          placeholder="🔍 Search subjects..."
                          value={searchQueries[slotIndex] || ''}
                          onChange={(e) =>
                            setSearchQueries((prev) => ({
                              ...prev,
                              [slotIndex]: e.target.value,
                            }))
                          }
                          className="pl-9 h-9 text-xs bg-background rounded-lg focus-visible:ring-[#20B486]"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Dropdown Options List */}
                    <div className="max-h-[260px] overflow-y-auto p-2 space-y-1">
                      {filteredList.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No matching subjects found. You can add it as a custom subject below!
                        </div>
                      ) : (
                        filteredList.map((sub) => {
                          const isChosenElsewhere = currentSelectedInOtherSlots.has(sub.name);
                          const isCurrentSelected = selectedSubject === sub.name;

                          return (
                            <button
                              key={sub.name}
                              type="button"
                              disabled={isChosenElsewhere}
                              onClick={() => handleSelectSubject(slotIndex, sub.name)}
                              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                isCurrentSelected
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#063B2A] dark:text-emerald-300 font-semibold'
                                  : isChosenElsewhere
                                  ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                                  : 'hover:bg-muted text-foreground'
                              }`}
                            >
                              <span className="truncate pr-2 font-medium">{sub.name}</span>

                              <div className="shrink-0 flex items-center gap-1">
                                {isCurrentSelected && (
                                  <Check className="w-3.5 h-3.5 text-[#20B486]" />
                                )}
                                {isChosenElsewhere && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    Selected
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Bottom Custom Subject Section */}
                    <div className="p-3 border-t border-border bg-muted/20">
                      {customFormSlot === slotIndex ? (
                        <div className="space-y-2.5 animate-fade-in p-0.5">
                          <div className="flex items-center justify-between pb-1 border-b border-border/40">
                            <span className="text-xs font-bold text-foreground">
                              Add Custom Subject
                            </span>
                            <button
                              type="button"
                              onClick={() => setCustomFormSlot(null)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-foreground">
                              Enter subject name
                            </Label>
                            <Input
                              placeholder="e.g. Operating Systems"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              className="h-8 text-xs bg-background"
                              autoFocus
                            />
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddCustomSubject(slotIndex)}
                            className="w-full h-8 text-xs bg-[#063B2A] hover:bg-[#0A4D37] text-white font-semibold mt-1"
                          >
                            Add Subject
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomFormSlot(slotIndex);
                            setCustomName(searchQueries[slotIndex] || '');
                          }}
                          className="w-full py-1.5 px-2 text-xs font-semibold text-[#20B486] hover:text-[#063B2A] dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Add custom subject
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
