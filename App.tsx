import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Kiểu task
interface ItemEntity {
  id: number;
  done: boolean;
  value: string;
}

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SQLiteProvider databaseName="db.db" onInit={migrateDbIfNeeded}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="TaskList" component={TaskListScreen} />
          <Stack.Screen name="AddJob" component={AddJobScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SQLiteProvider>
  );
}

// --- Màn hình 1: Welcome ---
function WelcomeScreen({ navigation }) {
  const [name, setName] = useState('');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.welcomeContainer}
    >
      <Text style={styles.welcomeTitle}>MANAGE YOUR TASK</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputIcon}>✉️</Text>
        <TextInput
          placeholder="Enter your name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
      </View>

      <TouchableOpacity
        style={styles.getStartedButton}
        disabled={name.trim().length === 0}
        onPress={() => navigation.replace('TaskList', { userName: name.trim() })}
      >
        <Text style={styles.getStartedButtonText}>GET STARTED →</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

// --- Màn hình 2: Task List ---
function TaskListScreen({ navigation, route }) {
  const db = useSQLiteContext();
  const userName = route.params?.userName || 'User';

  const [searchText, setSearchText] = useState('');
  const [todoItems, setTodoItems] = useState<ItemEntity[]>([]);
  const [doneItems, setDoneItems] = useState<ItemEntity[]>([]);

  // Lấy danh sách task từ db
  const refetchItems = useCallback(() => {
    async function refetch() {
      await db.withExclusiveTransactionAsync(async () => {
        let allTodos = await db.getAllAsync<ItemEntity>(
          `SELECT * FROM items WHERE done = 0 AND value LIKE ? ORDER BY id DESC`,
          `%${searchText}%`
        );
        setTodoItems(allTodos);

        let allDone = await db.getAllAsync<ItemEntity>(
          `SELECT * FROM items WHERE done = 1 AND value LIKE ? ORDER BY id DESC`,
          `%${searchText}%`
        );
        setDoneItems(allDone);
      });
    }
    refetch();
  }, [db, searchText]);

  useEffect(() => {
    refetchItems();
  }, [refetchItems]);

  // Cập nhật done task
  const onCheckTask = async (id: number) => {
    await db.runAsync('UPDATE items SET done = ? WHERE id = ?;', true, id);
    refetchItems();
  };

  // Xóa task
  const onDeleteTask = async (id: number) => {
    await db.runAsync('DELETE FROM items WHERE id = ?;', id);
    refetchItems();
  };

  // Chuyển sang màn hình thêm task
  const onAddTask = () => {
    navigation.navigate('AddJob', { refetchItems });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Image
            source={{
              uri: 'https://randomuser.me/api/portraits/women/44.jpg',
            }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.userName}>Hi {userName}</Text>
            <Text style={styles.userSubtitle}>Have a great day ahead</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          placeholder="Search"
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Task List */}
      <ScrollView style={styles.listArea} contentContainerStyle={{ paddingBottom: 80 }}>
        <Text style={styles.sectionHeading}>Todo</Text>
        {todoItems.length === 0 && <Text style={styles.emptyText}>No tasks found</Text>}
        {todoItems.map((item) => (
          <View key={item.id} style={styles.taskItem}>
            <TouchableOpacity style={styles.checkbox} onPress={() => onCheckTask(item.id)}>
              {!item.done && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.taskText}>{item.value}</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.deleteButton} onPress={() => onDeleteTask(item.id)}>
                <Text style={styles.deleteText}>🟥</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled>
                <Text style={styles.editText}>✎</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionHeading, { marginTop: 24 }]}>Completed</Text>
        {doneItems.length === 0 && <Text style={styles.emptyText}>No completed tasks</Text>}
        {doneItems.map((item) => (
          <View key={item.id} style={[styles.taskItem, styles.taskItemDone]}>
            <Text style={[styles.taskText, styles.taskTextDone]}>{item.value}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity style={styles.addButton} onPress={onAddTask}>
        <Text style={styles.addButtonText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// --- Màn hình 3: Add Job ---
function AddJobScreen({ navigation, route }) {
  const db = useSQLiteContext();
  const [job, setJob] = useState('');
  const refetchItems = route.params?.refetchItems || (() => {});

  const onFinish = async () => {
    if (job.trim() !== '') {
      // Chú ý: done phải là boolean, không phải string
      await db.runAsync('INSERT INTO items (done, value) VALUES (?, ?);', false, job.trim());
      refetchItems();
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.addJobContainer}
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ alignSelf: 'flex-start', marginBottom: 10 }}
      >
        <Text style={{ fontSize: 24 }}>←</Text>
      </TouchableOpacity>
      <Text style={styles.addJobTitle}>ADD YOUR JOB</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputIcon}>📊</Text>
        <TextInput placeholder="Input your job" style={styles.input} value={job} onChangeText={setJob} />
      </View>

      <TouchableOpacity
        style={[styles.getStartedButton, { marginTop: 20, alignSelf: 'center' }]}
        onPress={onFinish}
        disabled={job.trim().length === 0}
      >
        <Text style={styles.getStartedButtonText}>FINISH →</Text>
      </TouchableOpacity>

      <Image
        source={{
          uri: 'https://i.imgur.com/Z5R5pFv.png',
        }}
        style={styles.noteImage}
      />
    </KeyboardAvoidingView>
  );
}

// --- Database Migration ---
async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 1;
  let { user_version: currentDbVersion } = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }
  if (currentDbVersion === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';
CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY NOT NULL, done INT, value TEXT);
`);
    currentDbVersion = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

// --- Styles ---
const styles = StyleSheet.create({
  // Common
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#4630eb',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: '#fff',
    marginHorizontal: 16,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },

  // Welcome Screen
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  welcomeTitle: {
    fontSize: 20,
    color: '#8561c5', // tím nhẹ
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 48,
  },
  getStartedButton: {
    backgroundColor: '#00c9e6',
    marginHorizontal: 16,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Task List Screen
  container: {
    backgroundColor: '#fff',
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backArrow: {
    fontSize: 24,
    marginRight: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 44,
    marginRight: 10,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  userSubtitle: {
    fontSize: 12,
    color: '#888',
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
    color: '#888',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#999',
    marginBottom: 10,
  },
  taskItem: {
    flexDirection: 'row',
    backgroundColor: '#e8f1f3',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#a7d8b3',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  taskItemDone: {
    backgroundColor: '#1c9963',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1c9963',
    backgroundColor: '#a7d8b3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  checkmark: {
    color: '#1c9963',
    fontWeight: 'bold',
    fontSize: 16,
  },
  taskText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  taskTextDone: {
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  deleteButton: {
    marginRight: 14,
  },
  deleteText: {
    fontSize: 18,
    color: 'red',
  },
  editText: {
    fontSize: 18,
    color: '#ff4081',
  },
  addButton: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 60,
    backgroundColor: '#00c9e6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 32,
    color: '#fff',
    lineHeight: 32,
  },

  // Add Job Screen
  addJobContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  addJobTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8561c5',
    textAlign: 'center',
    marginBottom: 24,
  },
  noteImage: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginTop: 32,
  },
});
