import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Modal, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRating } from '../contexts/RatingContext';
import { getTask, rateTask } from '../services/authService';

export default function RatingOverlay() {
  const { pendingTaskId, dismissRating } = useRating();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [starRating, setStarRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!pendingTaskId) return;
    setLoading(true);
    setStarRating(0);
    setComment('');
    getTask(pendingTaskId)
      .then((data) => setTask(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pendingTaskId]);

  const handleSubmit = async () => {
    if (starRating === 0 || submitting) return;
    setSubmitting(true);
    try {
      await rateTask(pendingTaskId, starRating, comment);
      dismissRating();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not submit rating.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => dismissRating();

  const visible = pendingTaskId !== null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.container}>
              {loading ? (
                <View style={s.center}>
                  <ActivityIndicator size="large" color="#16A34A" />
                </View>
              ) : (
                <>
                  <View style={s.header}>
                    <Text style={s.title}>Rate your delivery</Text>
                    <Text style={s.driver}>{task?.driver_name || 'Driver'}</Text>
                  </View>

                  <View style={s.starSection}>
                    <Text style={s.prompt}>How was your experience?</Text>
                    <View style={s.starRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity key={n} onPress={() => setStarRating(n)}>
                          <MaterialIcons
                            name={n <= starRating ? 'star' : 'star-outline'}
                            size={48}
                            color={n <= starRating ? '#F59E0B' : '#D1D5DB'}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TextInput
                    style={s.commentInput}
                    placeholder="Leave a comment (optional)..."
                    placeholderTextColor="#9CA3AF"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    maxLength={500}
                  />

                  <View style={{ flex: 1 }} />

                  <View style={s.bottom}>
                    <TouchableOpacity
                      style={[s.submitBtn, (starRating === 0 || submitting) && { opacity: 0.5 }]}
                      onPress={handleSubmit}
                      disabled={starRating === 0 || submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.submitText}>Submit</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSkip}>
                      <Text style={s.skipText}>Skip</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  container:   { flex: 1, backgroundColor: '#fff', paddingHorizontal: 28 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { paddingTop: 60, alignItems: 'center' },
  title:       { fontSize: 24, fontWeight: '800', color: '#111827' },
  driver:      { fontSize: 16, color: '#6B7280', marginTop: 6 },
  starSection: { alignItems: 'center', marginTop: 48 },
  prompt:      { fontSize: 16, color: '#374151', marginBottom: 20 },
  starRow:     { flexDirection: 'row', gap: 8 },
  commentInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, fontSize: 15, color: '#111827', minHeight: 80, textAlignVertical: 'top', backgroundColor: '#FAFAFA', marginTop: 40 },
  bottom:      { paddingBottom: 40, gap: 12 },
  submitBtn:   { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, backgroundColor: '#F59E0B' },
  submitText:  { fontSize: 17, fontWeight: '700', color: '#fff' },
  skipText:    { textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#9CA3AF', paddingVertical: 8 },
});
