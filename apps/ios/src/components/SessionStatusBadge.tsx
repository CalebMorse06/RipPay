import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {SessionStatus} from '@coldtap/shared';

const STATUS_CONFIG: Record<SessionStatus, {label: string; color: string; bg: string}> = {
  CREATED: {label: 'Created', color: '#9CA3AF', bg: '#1F2937'},
  AWAITING_BUYER: {label: 'Waiting for you', color: '#60A5FA', bg: '#1E3A5F'},
  AWAITING_SIGNATURE: {label: 'Awaiting Signature', color: '#FBBF24', bg: '#3D2B0A'},
  SUBMITTED: {label: 'Submitted', color: '#34D399', bg: '#0A3025'},
  VALIDATING: {label: 'Validating', color: '#A78BFA', bg: '#2D1F5E'},
  PAID: {label: 'Paid', color: '#10B981', bg: '#052E16'},
  FAILED: {label: 'Failed', color: '#F87171', bg: '#3D0A0A'},
  EXPIRED: {label: 'Expired', color: '#9CA3AF', bg: '#1F2937'},
};

export default function SessionStatusBadge({status}: {status: SessionStatus}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.CREATED;
  return (
    <View style={[styles.badge, {backgroundColor: cfg.bg}]}>
      <Text style={[styles.label, {color: cfg.color}]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
